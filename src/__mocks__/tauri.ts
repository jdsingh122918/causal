import { vi } from "vitest";

/**
 * Mock Tauri invoke function for testing
 *
 * Usage in tests:
 * import { mockInvoke } from '@/__mocks__/tauri';
 * mockInvoke('command_name', mockReturnValue);
 */
export const mockInvoke = vi.fn();

/**
 * Mock successful responses for common Tauri commands
 */
export const mockTauriCommands = {
  // Project commands
  list_projects: vi.fn(() => Promise.resolve([])),
  create_project: vi.fn((project) => Promise.resolve({ id: 1, ...project })),
  get_project: vi.fn((id) => Promise.resolve({ id, name: "Test Project" })),
  update_project: vi.fn((project) => Promise.resolve(project)),
  delete_project: vi.fn(() => Promise.resolve()),

  // Recording commands
  list_recordings: vi.fn(() => Promise.resolve([])),
  create_recording: vi.fn((recording) =>
    Promise.resolve({ id: 1, ...recording }),
  ),
  get_recording: vi.fn((id) => Promise.resolve({ id, name: "Test Recording" })),
  update_recording_name: vi.fn((id, name) => Promise.resolve({ id, name })),
  delete_recording: vi.fn(() => Promise.resolve()),

  // Transcription commands
  list_audio_devices: vi.fn(() =>
    Promise.resolve([{ name: "Default Mic", index: 0 }]),
  ),
  start_transcription: vi.fn(() => Promise.resolve()),
  stop_transcription: vi.fn(() => Promise.resolve()),
  get_transcription_status: vi.fn(() => Promise.resolve({ is_active: false })),

  // Settings commands
  save_secure_setting: vi.fn(() => Promise.resolve()),
  load_secure_setting: vi.fn(() => Promise.resolve(null)),
  load_all_secure_settings: vi.fn(() => Promise.resolve({})),
};

/**
 * Setup mock invoke with default command handlers
 */
export const setupMockInvoke = () => {
  mockInvoke.mockImplementation((command: string, args?: any) => {
    const handler =
      mockTauriCommands[command as keyof typeof mockTauriCommands];
    if (handler) {
      return handler(args);
    }
    return Promise.reject(new Error(`Unmocked command: ${command}`));
  });

  return mockInvoke;
};

/**
 * Mock Tauri event listeners
 */
export const mockTauriEvents = {
  listen: vi.fn(() => Promise.resolve(() => {})),
  once: vi.fn(() => Promise.resolve(() => {})),
  emit: vi.fn(() => Promise.resolve()),
};

/**
 * Reset all Tauri mocks
 */
export const resetTauriMocks = () => {
  mockInvoke.mockReset();
  Object.values(mockTauriCommands).forEach((mock) => mock.mockReset());
  Object.values(mockTauriEvents).forEach((mock) => mock.mockReset());
};
