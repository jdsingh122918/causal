use futures_util::{SinkExt, StreamExt};
use serde::{Deserialize, Serialize};
use tokio::sync::mpsc;
use tokio_tungstenite::{connect_async, tungstenite::Message};

const ASSEMBLYAI_WS_URL: &str = "wss://streaming.assemblyai.com/v3/ws";

/// Result sent to frontend for each turn
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TranscriptResult {
    pub text: String,
    pub confidence: f32,
    pub is_final: bool,
    pub turn_order: u32,
    pub end_of_turn: bool,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub words: Vec<WordResult>,
}

/// Individual word in a turn
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WordResult {
    pub text: String,
    pub start: u32,
    pub end: u32,
    pub confidence: f32,
    pub is_final: bool,
}

/// Messages received from AssemblyAI
#[derive(Debug, Deserialize)]
#[serde(tag = "type")]
enum ServerMessage {
    Begin {
        id: String,
        #[allow(dead_code)]
        expires_at: u64, // Unix timestamp - received but not currently used
    },
    Turn {
        turn_order: u32,
        end_of_turn: bool,
        end_of_turn_confidence: f32,
        transcript: String,
        words: Vec<Word>,
    },
    Termination {
        audio_duration_seconds: f32,
        session_duration_seconds: f32,
    },
    Error {
        error: String
    },
}

/// Word structure from AssemblyAI
#[derive(Debug, Deserialize)]
struct Word {
    text: String,
    start: u32,
    end: u32,
    confidence: f32,
    word_is_final: bool,
}

/// Configuration for Universal Streaming
#[derive(Debug, Clone)]
pub struct StreamingConfig {
    pub format_turns: bool,
    pub end_of_turn_confidence_threshold: f32,
    pub min_end_of_turn_silence_when_confident: u32,
    pub max_turn_silence: u32,
}

impl Default for StreamingConfig {
    fn default() -> Self {
        Self {
            format_turns: false,
            end_of_turn_confidence_threshold: 0.4,
            min_end_of_turn_silence_when_confident: 400,
            max_turn_silence: 1280,
        }
    }
}

pub struct AssemblyAIClient {
    api_key: String,
}

impl AssemblyAIClient {
    pub fn new(api_key: String) -> Self {
        Self { api_key }
    }

    /// Stream audio to AssemblyAI Universal Streaming API
    pub async fn stream_audio(
        &self,
        mut audio_receiver: mpsc::Receiver<Vec<i16>>,
        transcript_sender: mpsc::UnboundedSender<TranscriptResult>,
        sample_rate: u32,
        config: StreamingConfig,
    ) -> Result<(), String> {
        tracing::info!("Connecting to AssemblyAI ({}Hz)...", sample_rate);

        // Build WebSocket URL with all configuration as query parameters
        let ws_url = format!(
            "{}?token={}&sample_rate={}&encoding=pcm_s16le&format_turns={}&end_of_turn_confidence_threshold={}&min_end_of_turn_silence_when_confident={}&max_turn_silence={}",
            ASSEMBLYAI_WS_URL,
            self.api_key,
            sample_rate,
            config.format_turns,
            config.end_of_turn_confidence_threshold,
            config.min_end_of_turn_silence_when_confident,
            config.max_turn_silence
        );

        // Connect to WebSocket
        let (ws_stream, _response) = match connect_async(ws_url).await {
            Ok(result) => result,
            Err(e) => {
                tracing::error!("WebSocket connection error details: {:?}", e);
                return Err(format!("WebSocket connection failed: {}. Note: Ensure your API key is valid and you have network connectivity.", e));
            }
        };

        tracing::info!("Connected to AssemblyAI ✓");

        let (mut write, mut read) = ws_stream.split();

        // Spawn task to handle incoming messages
        let transcript_tx = transcript_sender.clone();
        let read_handle = tokio::spawn(async move {
            while let Some(msg_result) = read.next().await {
                match msg_result {
                    Ok(Message::Text(text)) => {
                        match serde_json::from_str::<ServerMessage>(&text) {
                            Ok(ServerMessage::Begin {
                                id,
                                expires_at: _,
                            }) => {
                                tracing::debug!("Session started: {}", id);
                            }
                            Ok(ServerMessage::Turn {
                                turn_order,
                                end_of_turn,
                                transcript,
                                words,
                                end_of_turn_confidence,
                            }) => {
                                if !transcript.is_empty() {
                                    let result = TranscriptResult {
                                        text: transcript.clone(),
                                        confidence: end_of_turn_confidence,
                                        is_final: end_of_turn,
                                        turn_order,
                                        end_of_turn,
                                        words: words
                                            .into_iter()
                                            .map(|w| WordResult {
                                                text: w.text,
                                                start: w.start,
                                                end: w.end,
                                                confidence: w.confidence,
                                                is_final: w.word_is_final,
                                            })
                                            .collect(),
                                    };

                                    // Log both partial and complete turns for debugging
                                    let preview = if transcript.len() > 60 {
                                        format!("{}...", &transcript[..60])
                                    } else {
                                        transcript.clone()
                                    };

                                    if end_of_turn {
                                        tracing::info!(
                                            "✓ Turn {}: \"{}\"",
                                            turn_order,
                                            preview
                                        );
                                    } else {
                                        tracing::debug!(
                                            "⋯ Turn {} (partial): \"{}\"",
                                            turn_order,
                                            preview
                                        );
                                    }

                                    if let Err(e) = transcript_tx.send(result) {
                                        // This is expected when stopping - the receiver is dropped
                                        tracing::debug!("Transcript receiver closed (normal during stop): {}", e);
                                        break;
                                    }
                                }
                            }
                            Ok(ServerMessage::Termination {
                                audio_duration_seconds,
                                session_duration_seconds,
                            }) => {
                                tracing::info!(
                                    "Session terminated. Audio: {:.2}s, Session: {:.2}s",
                                    audio_duration_seconds,
                                    session_duration_seconds
                                );
                                break;
                            }
                            Ok(ServerMessage::Error { error }) => {
                                tracing::error!("AssemblyAI error: {}", error);
                                break;
                            }
                            Err(e) => {
                                tracing::error!("Failed to parse message: {}", e);
                            }
                        }
                    }
                    Ok(Message::Binary(_)) => {
                        tracing::warn!("Received unexpected binary message");
                    }
                    Ok(Message::Close(frame)) => {
                        tracing::info!("WebSocket closed by server: {:?}", frame);
                        break;
                    }
                    Err(e) => {
                        tracing::error!("WebSocket error: {}", e);
                        break;
                    }
                    _ => {}
                }
            }
            tracing::info!("Message handler exiting");
        });

        // Spawn task to send audio data
        let write_handle = tokio::spawn(async move {
            let mut sample_count = 0usize;
            let mut first_chunk = true;

            loop {
                // Check if channel is closed (no more samples coming)
                match audio_receiver.recv().await {
                    Some(samples) => {
                        if first_chunk {
                            tracing::info!("🎤 Streaming started");
                            first_chunk = false;
                        }

                        sample_count += samples.len();

                        // Convert i16 samples to bytes (PCM S16LE - little endian)
                        let mut bytes = Vec::with_capacity(samples.len() * 2);
                        for sample in samples {
                            bytes.extend_from_slice(&sample.to_le_bytes());
                        }

                        if let Err(e) = write.send(Message::Binary(bytes)).await {
                            tracing::error!("Failed to send audio: {}", e);
                            break;
                        }

                        if sample_count % (48000 * 10) == 0 {
                            // Log every 10 seconds (at 48kHz)
                            tracing::info!("🎤 Audio streaming: ~{:.0}s", sample_count as f32 / 48000.0);
                        }
                    }
                    None => {
                        // Channel closed by sender (stop command received)
                        // Exit immediately WITHOUT draining buffered messages
                        tracing::info!("Audio channel closed - stopping immediately");
                        break;
                    }
                }
            }

            tracing::info!(
                "🎤 Audio streaming completed - {} samples (~{:.2}s)",
                sample_count,
                sample_count as f32 / 48000.0
            );

            // Send terminate message to close the session cleanly
            let terminate_msg = r#"{"type":"terminate"}"#;
            if let Err(e) = write.send(Message::Text(terminate_msg.to_string())).await {
                tracing::debug!("Failed to send terminate message (expected if stopped): {}", e);
            } else {
                tracing::info!("Terminate message sent");
            }

            // Close the WebSocket writer
            if let Err(e) = write.close().await {
                tracing::debug!("Failed to close WebSocket writer (expected if stopped): {}", e);
            } else {
                tracing::info!("WebSocket writer closed cleanly");
            }
        });

        // Wait for both tasks
        tokio::select! {
            result = read_handle => {
                tracing::info!("Read handle completed: {:?}", result);
            }
            result = write_handle => {
                tracing::info!("Write handle completed: {:?}", result);
            }
        }

        Ok(())
    }
}
