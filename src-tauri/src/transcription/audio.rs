use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use cpal::{Device, StreamConfig};
use serde::{Deserialize, Serialize};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{mpsc as std_mpsc, Arc, Mutex};
use std::thread;
use tokio::sync::mpsc;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AudioDevice {
    pub id: String,
    pub name: String,
    pub is_default: bool,
    pub device_type: AudioDeviceType,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum AudioDeviceType {
    Input,
    Output,
}

/// List all available audio devices
pub fn list_audio_devices() -> Result<Vec<AudioDevice>, String> {
    let host = cpal::default_host();
    let mut devices = Vec::new();

    // Get input devices
    if let Ok(input_devices) = host.input_devices() {
        let default_input = host.default_input_device();
        for (idx, device) in input_devices.enumerate() {
            if let Ok(name) = device.name() {
                let is_default = default_input
                    .as_ref()
                    .and_then(|d| d.name().ok())
                    .map(|d| d == name)
                    .unwrap_or(false);

                devices.push(AudioDevice {
                    id: format!("input_{}", idx),
                    name,
                    is_default,
                    device_type: AudioDeviceType::Input,
                });
            }
        }
    }

    // Get output devices (for loopback/system audio)
    if let Ok(output_devices) = host.output_devices() {
        let default_output = host.default_output_device();
        for (idx, device) in output_devices.enumerate() {
            if let Ok(name) = device.name() {
                let is_default = default_output
                    .as_ref()
                    .and_then(|d| d.name().ok())
                    .map(|d| d == name)
                    .unwrap_or(false);

                devices.push(AudioDevice {
                    id: format!("output_{}", idx),
                    name,
                    is_default,
                    device_type: AudioDeviceType::Output,
                });
            }
        }
    }

    Ok(devices)
}

/// Get a specific audio device by ID
pub fn get_device_by_id(device_id: &str) -> Result<Device, String> {
    let host = cpal::default_host();

    if device_id.starts_with("input_") {
        let idx: usize = device_id
            .strip_prefix("input_")
            .and_then(|s| s.parse().ok())
            .ok_or("Invalid device ID")?;

        host.input_devices()
            .map_err(|e| e.to_string())?
            .nth(idx)
            .ok_or_else(|| "Device not found".to_string())
    } else if device_id.starts_with("output_") {
        let idx: usize = device_id
            .strip_prefix("output_")
            .and_then(|s| s.parse().ok())
            .ok_or("Invalid device ID")?;

        host.output_devices()
            .map_err(|e| e.to_string())?
            .nth(idx)
            .ok_or_else(|| "Device not found".to_string())
    } else {
        Err("Invalid device ID format".to_string())
    }
}

/// Target chunk duration in milliseconds
/// AssemblyAI requires between 50ms and 1000ms per chunk
const CHUNK_DURATION_MS: f32 = 50.0;

/// Commands for controlling the audio thread
enum AudioThreadCommand {
    Stop,
}

/// Handle to control the audio capture thread
pub struct AudioCaptureHandle {
    command_tx: std_mpsc::Sender<AudioThreadCommand>,
    thread_handle: Option<thread::JoinHandle<()>>,
    stop_flag: Arc<AtomicBool>,
}

impl AudioCaptureHandle {
    /// Stop the audio capture and wait for the thread to finish
    pub fn stop(mut self) -> Result<(), String> {
        // Set stop flag immediately - this will make the audio callback exit fast
        self.stop_flag.store(true, Ordering::Release);
        tracing::info!("Stop flag set - audio callback will exit");

        if let Some(handle) = self.thread_handle.take() {
            // Send stop command
            let _ = self.command_tx.send(AudioThreadCommand::Stop);

            // Wait for thread to finish
            handle
                .join()
                .map_err(|_| "Failed to join audio thread".to_string())?;
        }
        Ok(())
    }
}

pub struct AudioCapture {
    device: Device,
    config: StreamConfig,
    chunk_sender: mpsc::Sender<Vec<i16>>,
}

impl AudioCapture {
    /// Create a new audio capture instance for real-time streaming
    pub fn new(device: Device, chunk_sender: mpsc::Sender<Vec<i16>>) -> Result<Self, String> {
        // Get the default input config
        let config = device
            .default_input_config()
            .map_err(|e| format!("Failed to get default input config: {}", e))?;

        tracing::info!(
            "Device config - Sample rate: {}, Channels: {}, Format: {:?}",
            config.sample_rate().0,
            config.channels(),
            config.sample_format()
        );

        let config = config.into();

        Ok(Self {
            device,
            config,
            chunk_sender,
        })
    }

    /// Start capturing audio on a dedicated thread
    /// Returns a handle that can be used to stop the capture
    pub fn start(self) -> Result<AudioCaptureHandle, String> {
        // Create a channel for controlling the audio thread
        let (cmd_tx, cmd_rx) = std_mpsc::channel::<AudioThreadCommand>();

        // Create a stop flag that the audio callback can check
        let stop_flag = Arc::new(AtomicBool::new(false));
        let stop_flag_clone = stop_flag.clone();

        // Spawn a dedicated thread for audio capture
        // This is necessary because cpal::Stream is not Send on macOS
        let thread_handle = thread::spawn(move || {
            let stream = match self.start_stream(stop_flag_clone) {
                Ok(s) => s,
                Err(e) => {
                    tracing::error!("Failed to start audio stream: {}", e);
                    return;
                }
            };

            tracing::debug!("Audio stream started on dedicated thread");

            // Keep the stream alive until we receive a stop command
            loop {
                match cmd_rx.recv_timeout(std::time::Duration::from_millis(100)) {
                    Ok(AudioThreadCommand::Stop) => {
                        tracing::info!("Received stop command, shutting down audio thread");
                        break;
                    }
                    Err(std_mpsc::RecvTimeoutError::Timeout) => {
                        // Continue running
                        continue;
                    }
                    Err(std_mpsc::RecvTimeoutError::Disconnected) => {
                        tracing::warn!("Command channel disconnected, shutting down audio thread");
                        break;
                    }
                }
            }

            // Stream will be dropped here, properly cleaning up resources
            drop(stream);
            tracing::info!("Audio thread shut down cleanly");
        });

        Ok(AudioCaptureHandle {
            command_tx: cmd_tx,
            thread_handle: Some(thread_handle),
            stop_flag,
        })
    }

    /// Internal method to create and start the audio stream
    /// This runs on the dedicated audio thread
    fn start_stream(&self, stop_flag: Arc<AtomicBool>) -> Result<cpal::Stream, String> {
        let channels = self.config.channels as usize;
        let sample_rate = self.config.sample_rate.0;
        let chunk_sender = self.chunk_sender.clone();

        // Calculate chunk size based on sample rate to ensure 50ms chunks
        // AssemblyAI requires between 50ms and 1000ms
        let chunk_size = ((sample_rate as f32 * CHUNK_DURATION_MS) / 1000.0) as usize;

        tracing::info!(
            "Audio capture: {}Hz, {} channel(s), {}ms chunks",
            sample_rate,
            channels,
            CHUNK_DURATION_MS
        );

        // Create a buffer for accumulating samples
        let buffer = Arc::new(Mutex::new(Vec::with_capacity(chunk_size)));

        // Audio level monitoring
        let last_level_log = Arc::new(Mutex::new(std::time::Instant::now()));
        let sample_count = Arc::new(Mutex::new(0usize));

        // Build the input stream
        let stream = self
            .device
            .build_input_stream(
                &self.config,
                move |data: &[f32], _: &cpal::InputCallbackInfo| {
                    // Check stop flag first - exit immediately if stopping
                    if stop_flag.load(Ordering::Acquire) {
                        return; // Exit callback immediately
                    }
                    // Convert stereo to mono if needed
                    let mono_data: Vec<f32> = if channels == 1 {
                        data.to_vec()
                    } else {
                        // Average channels to create mono
                        data.chunks(channels)
                            .map(|chunk| chunk.iter().sum::<f32>() / channels as f32)
                            .collect()
                    };

                    // Calculate audio level (RMS) for monitoring
                    let rms = if !mono_data.is_empty() {
                        let sum_squares: f32 = mono_data.iter().map(|&s| s * s).sum();
                        (sum_squares / mono_data.len() as f32).sqrt()
                    } else {
                        0.0
                    };

                    // Log audio level every 15 seconds to help diagnose silent input
                    {
                        let mut count = sample_count.lock().unwrap();
                        *count += mono_data.len();

                        let mut last_log = last_level_log.lock().unwrap();
                        if last_log.elapsed().as_secs() >= 15 {
                            let db = if rms > 0.0 {
                                20.0 * rms.log10()
                            } else {
                                -100.0
                            };

                            if rms < 0.001 {
                                tracing::warn!("🔇 Audio silent ({:.1} dB). Check microphone selection/mute/volume", db);
                            } else {
                                tracing::info!("🔊 Audio level: {:.1} dB", db);
                            }

                            *last_log = std::time::Instant::now();
                        }
                    }

                    // Convert f32 to i16 PCM samples
                    let pcm_samples: Vec<i16> = mono_data
                        .iter()
                        .map(|&sample| {
                            (sample.clamp(-1.0, 1.0) * 32767.0) as i16
                        })
                        .collect();

                    // Add to buffer and send when we have enough samples
                    let mut buf = buffer.lock().unwrap();
                    buf.extend_from_slice(&pcm_samples);

                    // Send chunks when we have enough samples for the target duration
                    while buf.len() >= chunk_size {
                        let chunk: Vec<i16> = buf.drain(0..chunk_size).collect();
                        // Try to send chunk - if channel is full or closed, use try_send
                        // This prevents blocking the audio thread if the receiver is slow
                        if chunk_sender.try_send(chunk).is_err() {
                            // Channel full or closed - expected during shutdown or if receiver is slow
                            break;
                        }
                    }
                },
                move |err| {
                    tracing::error!("Audio stream error: {}", err);
                },
                None,
            )
            .map_err(|e| format!("Failed to build input stream: {}", e))?;

        stream
            .play()
            .map_err(|e| format!("Failed to start audio stream: {}", e))?;

        Ok(stream)
    }
}
