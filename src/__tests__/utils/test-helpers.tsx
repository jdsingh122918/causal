import { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { AppProviders } from '@/contexts/AppProviders';
import { Project, Recording } from '@/lib/types';

/**
 * Custom render function that wraps components with necessary providers
 */
export function renderWithProviders(
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) {
  function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <BrowserRouter>
        <AppProviders>{children}</AppProviders>
      </BrowserRouter>
    );
  }

  return render(ui, { wrapper: Wrapper, ...options });
}

/**
 * Create a mock project for testing
 */
export function createMockProject(overrides?: Partial<Project>): Project {
  return {
    id: 1,
    name: 'Test Project',
    description: 'A test project for unit testing',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

/**
 * Create a mock recording for testing
 */
export function createMockRecording(overrides?: Partial<Recording>): Recording {
  return {
    id: 1,
    project_id: 1,
    name: 'Test Recording',
    transcript: 'This is a test transcript.',
    enhanced_transcript: 'This is an enhanced test transcript.',
    duration_seconds: 120,
    created_at: new Date().toISOString(),
    metadata: null,
    ...overrides,
  };
}

/**
 * Create multiple mock projects
 */
export function createMockProjects(count: number): Project[] {
  return Array.from({ length: count }, (_, i) =>
    createMockProject({
      id: i + 1,
      name: `Project ${i + 1}`,
    })
  );
}

/**
 * Create multiple mock recordings
 */
export function createMockRecordings(count: number, projectId: number = 1): Recording[] {
  return Array.from({ length: count }, (_, i) =>
    createMockRecording({
      id: i + 1,
      project_id: projectId,
      name: `Recording ${i + 1}`,
    })
  );
}

/**
 * Wait for async operations to complete
 */
export const waitForAsync = () =>
  new Promise((resolve) => setTimeout(resolve, 0));

/**
 * Mock transcription status
 */
export function createMockTranscriptionStatus(overrides?: any) {
  return {
    is_active: false,
    current_device: null,
    started_at: null,
    ...overrides,
  };
}

/**
 * Mock audio device
 */
export function createMockAudioDevice(overrides?: any) {
  return {
    name: 'Default Microphone',
    index: 0,
    ...overrides,
  };
}

/**
 * Mock settings
 */
export interface MockSettings {
  assembly_ai_api_key?: string;
  claude_api_key?: string;
  refinement_mode?: 'disabled' | 'realtime' | 'chunked';
  chunk_duration_secs?: number;
  selected_device_index?: number;
}

export function createMockSettings(overrides?: MockSettings): MockSettings {
  return {
    assembly_ai_api_key: 'test-assembly-key',
    claude_api_key: 'test-claude-key',
    refinement_mode: 'chunked',
    chunk_duration_secs: 15,
    selected_device_index: 0,
    ...overrides,
  };
}

/**
 * Assert error message in console
 */
export function expectConsoleError(callback: () => void, expectedMessage?: string) {
  const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

  callback();

  if (expectedMessage) {
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining(expectedMessage)
    );
  } else {
    expect(consoleSpy).toHaveBeenCalled();
  }

  consoleSpy.mockRestore();
}

// Re-export testing library utilities
export * from '@testing-library/react';
export { default as userEvent } from '@testing-library/user-event';
