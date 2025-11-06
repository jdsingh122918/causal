# Comprehensive Testing Strategy for Causal Application

## Executive Summary

This document outlines the testing strategy for the Causal desktop application - a Tauri v2 app with React frontend and Rust backend that provides real-time AI-powered transcription services.

## Current Testing State

### Existing Tests
- **Backend Rust Tests**: Limited unit tests in:
  - `encryption.rs` - 3 tests for encryption/decryption operations
  - `buffer.rs` - 3 tests for transcription buffer management
  - Several modules with `#[cfg(test)]` blocks but incomplete coverage
  - **Issues**: 4 failing doctests due to module visibility

### Testing Gaps
- **Frontend**: No testing infrastructure (0% coverage)
- **Backend**: ~15% coverage (encryption + buffer only)
- **Integration**: No tests for Tauri command handlers
- **E2E**: No end-to-end testing framework
- **Performance**: No benchmarking or load testing
- **API Integration**: No mocking for external services

## Testing Strategy Overview

### Testing Pyramid

```
        ┌─────────────┐
        │  E2E Tests  │  (10%)
        │  Playwright │
        └─────────────┘
      ┌───────────────────┐
      │ Integration Tests │  (30%)
      │  Frontend ↔ Rust  │
      └───────────────────┘
  ┌─────────────────────────────┐
  │      Unit Tests              │  (60%)
  │  Frontend (Vitest + RTL)     │
  │  Backend (Rust #[test])      │
  └─────────────────────────────┘
```

### Coverage Goals
- **Frontend**: 80% line coverage for business logic
- **Backend**: 85% line coverage for core modules
- **Integration**: 100% coverage of Tauri commands
- **E2E**: Critical user workflows only

## Testing Infrastructure

### 1. Frontend Testing (React + TypeScript)

#### Framework: Vitest + React Testing Library

**Rationale:**
- Vitest: Fast, Vite-native, compatible with existing build setup
- React Testing Library: Industry standard, focuses on user behavior
- JSDOM: Lightweight DOM simulation for unit tests

#### Setup Components:
```
vitest.config.ts          - Test configuration
src/__tests__/            - Test directory structure
  ├── unit/               - Component & hook tests
  ├── integration/        - Context & provider tests
  └── utils/              - Test utilities & mocks
src/__mocks__/            - Mock implementations
  ├── tauri.ts            - Mock Tauri API
  └── contexts.tsx        - Mock context providers
```

#### Test Categories:

1. **Component Tests** (40% of frontend tests)
   - UI components in isolation
   - Props validation
   - Event handling
   - Conditional rendering

2. **Hook Tests** (20% of frontend tests)
   - Custom hooks logic
   - State management
   - Side effects

3. **Context Tests** (20% of frontend tests)
   - Context providers
   - State updates
   - Context consumers

4. **Integration Tests** (20% of frontend tests)
   - Component + Context integration
   - Multi-component workflows
   - Tauri command invocations

### 2. Backend Testing (Rust)

#### Framework: Built-in Rust Testing + tokio-test

**Rationale:**
- Native Rust testing is robust and well-integrated
- tokio-test for async operations
- mockall for trait mocking

#### Setup Components:
```
src-tauri/
  ├── src/
  │   ├── **/*.rs          - Tests alongside code (#[cfg(test)])
  │   └── test_utils/      - Shared test utilities
  ├── tests/               - Integration tests
  │   ├── commands/        - Tauri command tests
  │   ├── database/        - Database integration tests
  │   └── transcription/   - Transcription workflow tests
  └── Cargo.toml           - Test dependencies
```

#### Test Categories:

1. **Unit Tests** (50% of backend tests)
   - Individual functions
   - Data structures
   - Business logic
   - Error handling

2. **Module Tests** (30% of backend tests)
   - Module-level functionality
   - Internal APIs
   - State management

3. **Integration Tests** (20% of backend tests)
   - Database operations
   - API interactions (mocked)
   - Cross-module workflows

### 3. E2E Testing (Playwright)

#### Framework: Playwright for Desktop

**Rationale:**
- Supports desktop app automation
- Cross-platform testing
- Network interception for API mocking

#### Setup Components:
```
e2e/
  ├── tests/
  │   ├── transcription.spec.ts
  │   ├── projects.spec.ts
  │   ├── settings.spec.ts
  │   └── recordings.spec.ts
  ├── fixtures/
  │   ├── audio-samples/
  │   └── database-states/
  ├── helpers/
  │   ├── app-launcher.ts
  │   └── mock-servers.ts
  └── playwright.config.ts
```

#### Test Scenarios:

1. **Critical User Workflows**
   - Project creation and selection
   - Start/stop transcription
   - API key configuration
   - Recording playback and export

2. **Error Scenarios**
   - Network failures
   - Invalid API keys
   - Disk space issues
   - Concurrent operations

### 4. API Mocking Strategy

#### External Services:
- **AssemblyAI Streaming API** - WebSocket transcription service
- **Claude AI API** - Transcript enhancement service

#### Mocking Approaches:

1. **Unit/Integration Tests**:
   - Mock HTTP/WebSocket clients
   - Predictable responses
   - Error injection

2. **E2E Tests**:
   - Mock server (MSW or custom)
   - Realistic response timing
   - State simulation

#### Mock Server Setup:
```
tests/mocks/
  ├── assemblyai-server.ts     - Mock WebSocket server
  ├── claude-server.ts          - Mock HTTP API
  └── fixtures/
      ├── transcription-responses.json
      └── enhancement-responses.json
```

## Test Scenarios for Business Intelligence Features

### Performance Testing (Parallel Processing)

#### Baseline Measurements (Current):
- Buffer processing latency: 1.5s - 33s
- Single-threaded enhancement
- Sequential buffer processing

#### Target Measurements (Parallel):
- Buffer processing latency: 300ms - 800ms
- Multi-threaded enhancement (4 workers)
- Concurrent buffer processing

#### Test Scenarios:

1. **Concurrent Enhancement Processing**
   ```rust
   #[test]
   fn test_parallel_buffer_enhancement() {
       // Given: 10 buffers ready for enhancement
       // When: Process with 4 workers
       // Then: All complete within 2s
       // And: Maintain order integrity
   }
   ```

2. **Worker Pool Management**
   ```rust
   #[test]
   fn test_worker_failure_recovery() {
       // Given: 4 active workers
       // When: 1 worker crashes
       // Then: Task redistributed to healthy workers
       // And: System continues processing
   }
   ```

3. **Resource Constraints**
   ```rust
   #[test]
   fn test_memory_usage_under_load() {
       // Given: 100 concurrent buffers
       // When: Process with limited memory
       // Then: Memory stays under 500MB
       // And: No buffer overflow
   }
   ```

4. **Throughput Benchmarks**
   ```rust
   #[bench]
   fn bench_sequential_vs_parallel() {
       // Compare: Sequential vs 4-worker parallel
       // Measure: Processing time for 50 buffers
       // Expected: >75% latency reduction
   }
   ```

### Transcription Workflow Tests

1. **End-to-End Transcription**
   - Audio capture → AssemblyAI → Enhancement → Storage
   - Expected latency: < 1s per turn
   - Data integrity verification

2. **Real-time Processing**
   - Continuous audio streaming
   - Live transcript updates
   - Buffer management under load

3. **Error Recovery**
   - Network interruption
   - API rate limiting
   - Invalid audio format

## Performance Benchmarking

### Metrics to Track:

1. **Latency Metrics**
   - Buffer creation time
   - Enhancement processing time
   - Database write time
   - UI update latency

2. **Throughput Metrics**
   - Buffers processed per second
   - Concurrent enhancement capacity
   - API requests per minute

3. **Resource Metrics**
   - Memory usage (peak/average)
   - CPU utilization
   - Database size growth
   - Network bandwidth

### Benchmarking Tools:

```rust
// Criterion.rs for Rust benchmarks
[dev-dependencies]
criterion = "0.5"

// Frontend performance with Vitest bench
import { bench } from 'vitest'
```

## CI/CD Integration

### GitHub Actions Workflow:

```yaml
name: Comprehensive Testing

on: [push, pull_request]

jobs:
  frontend-tests:
    - Setup Node.js
    - Install dependencies
    - Run Vitest tests
    - Upload coverage to Codecov
    - Type checking (tsc)

  backend-tests:
    - Setup Rust
    - Run cargo test
    - Run cargo clippy
    - Upload coverage to Codecov

  integration-tests:
    - Build Tauri app
    - Run integration tests
    - Test database migrations

  e2e-tests:
    - Build production app
    - Run Playwright tests
    - Capture screenshots on failure

  performance-benchmarks:
    - Run criterion benchmarks
    - Compare against baseline
    - Report regression warnings
```

### Quality Gates:
- Frontend coverage > 80%
- Backend coverage > 85%
- All E2E tests passing
- No performance regression > 10%
- Type checking passing
- Linting passing (clippy + eslint)

## Testing Best Practices

### General Principles:
1. **Arrange-Act-Assert (AAA)** pattern
2. **Test behavior, not implementation**
3. **One assertion per test (when possible)**
4. **Descriptive test names**
5. **Fast, isolated, repeatable tests**

### Frontend Best Practices:
```typescript
// ✅ Good: Test user behavior
test('displays error when API key is invalid', async () => {
  render(<SettingsDialog />);
  await user.type(screen.getByLabelText('API Key'), 'invalid-key');
  await user.click(screen.getByRole('button', { name: 'Save' }));
  expect(screen.getByText(/invalid api key/i)).toBeInTheDocument();
});

// ❌ Bad: Test implementation details
test('sets apiKeyError state to true', () => {
  const wrapper = shallow(<SettingsDialog />);
  wrapper.instance().setState({ apiKeyError: true });
  expect(wrapper.state('apiKeyError')).toBe(true);
});
```

### Backend Best Practices:
```rust
// ✅ Good: Clear test organization
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn encrypts_and_decrypts_api_key_successfully() {
        let encryption = SettingsEncryption::new().unwrap();
        let plaintext = "test-api-key";

        let encrypted = encryption.encrypt(plaintext).unwrap();
        let decrypted = encryption.decrypt(&encrypted).unwrap();

        assert_eq!(plaintext, decrypted);
    }
}

// ✅ Good: Test error conditions
#[test]
fn returns_error_for_invalid_encrypted_data() {
    let encryption = SettingsEncryption::new().unwrap();
    let invalid_data = EncryptedData {
        encrypted_value: vec![1, 2, 3],
        salt: vec![],
    };

    assert!(encryption.decrypt(&invalid_data).is_err());
}
```

## Test Data Management

### Fixtures:
```
tests/fixtures/
  ├── audio/
  │   ├── short-speech-5s.wav
  │   ├── long-speech-60s.wav
  │   └── noisy-audio.wav
  ├── database/
  │   ├── empty-db.sql
  │   ├── sample-projects.sql
  │   └── sample-recordings.sql
  └── responses/
      ├── assemblyai-responses.json
      └── claude-responses.json
```

### Test Utilities:
```typescript
// Frontend helpers
export const createMockProject = (overrides?: Partial<Project>) => ({
  id: 1,
  name: 'Test Project',
  description: 'Test Description',
  created_at: new Date().toISOString(),
  ...overrides,
});

export const renderWithProviders = (ui: React.ReactElement) => {
  return render(
    <ProjectsProvider>
      <RecordingsProvider>
        {ui}
      </RecordingsProvider>
    </ProjectsProvider>
  );
};
```

```rust
// Backend helpers
pub fn create_test_database() -> Database {
    let db = Database::new().unwrap();
    // Seed with test data
    db
}

pub fn mock_transcription_buffer() -> TranscriptionBuffer {
    let mut buffer = TranscriptionBuffer::new(1);
    buffer.add_text("Test transcription".to_string());
    buffer
}
```

## Implementation Timeline

### Phase 1: Foundation (Week 1)
- [x] Setup Vitest for frontend
- [x] Setup tokio-test for backend
- [x] Create test directory structure
- [x] Configure CI/CD pipeline

### Phase 2: Unit Tests (Week 2-3)
- [ ] Frontend component tests (80% coverage)
- [ ] Backend module tests (85% coverage)
- [ ] Mock Tauri API
- [ ] Test utilities and helpers

### Phase 3: Integration Tests (Week 4)
- [ ] Tauri command handlers
- [ ] Database operations
- [ ] Context providers
- [ ] Error scenarios

### Phase 4: E2E Tests (Week 5)
- [ ] Playwright setup
- [ ] Critical user workflows
- [ ] Mock servers for APIs
- [ ] Screenshot and video capture

### Phase 5: Performance & Documentation (Week 6)
- [ ] Criterion benchmarks
- [ ] Parallel processing tests
- [ ] Performance baseline
- [ ] Testing documentation
- [ ] Developer testing guide

## Success Metrics

### Quantitative:
- Frontend test coverage: 80%+
- Backend test coverage: 85%+
- All CI checks passing
- E2E test suite < 5 min runtime
- Zero flaky tests

### Qualitative:
- Developers confident making changes
- Bugs caught in PR review
- Fast feedback loop (< 2 min for unit tests)
- Clear test failure messages
- Easy to run tests locally

## Maintenance & Evolution

### Regular Activities:
1. **Weekly**: Review test coverage reports
2. **Bi-weekly**: Update test fixtures and mocks
3. **Monthly**: Performance benchmark comparison
4. **Quarterly**: Testing strategy review

### Continuous Improvement:
- Monitor test flakiness
- Optimize slow tests
- Update mocks with real API changes
- Refactor test utilities
- Document new testing patterns

## Resources

### Documentation:
- [Vitest Documentation](https://vitest.dev)
- [React Testing Library](https://testing-library.com/react)
- [Rust Testing Book](https://doc.rust-lang.org/book/ch11-00-testing.html)
- [Playwright Documentation](https://playwright.dev)
- [Tauri Testing Guide](https://tauri.app/develop/tests/)

### Tools:
- **Coverage**: codecov.io
- **Benchmarking**: criterion.rs, vitest bench
- **Mocking**: MSW (frontend), mockall (backend)
- **CI/CD**: GitHub Actions

---

**Document Version**: 1.0
**Last Updated**: 2025-11-05
**Owner**: Development Team
