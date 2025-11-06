# Testing Guide for Causal Application

## Quick Start

### Running Tests Locally

```bash
# Frontend tests
npm run test              # Run in watch mode
npm run test:run          # Run once
npm run test:coverage     # Run with coverage report
npm run test:ui           # Open Vitest UI

# Backend tests
cd src-tauri
cargo test                # Run all Rust tests
cargo test -- --nocapture # Run with output visible

# Performance benchmarks
npm run bench             # Run Rust benchmarks

# E2E tests
npm run test:e2e          # Run Playwright tests
npm run test:e2e:ui       # Open Playwright UI

# All tests
npm run test:all          # Run frontend and backend tests
```

## Test Structure

### Frontend Tests (`src/__tests__/`)

```
src/__tests__/
├── unit/               # Component and hook tests
│   ├── components/     # UI component tests
│   └── hooks/          # Custom hook tests
├── integration/        # Context and provider tests
├── utils/              # Test utilities and helpers
│   └── test-helpers.tsx
└── setup.ts            # Test configuration
```

### Backend Tests (`src-tauri/tests/`)

```
src-tauri/tests/
├── commands/           # Tauri command tests
├── database/           # Database integration tests
└── transcription/      # Transcription workflow tests
```

## Writing Tests

### Frontend Component Tests

```typescript
import { describe, it, expect } from 'vitest';
import { render, screen, userEvent } from '@/__tests__/utils/test-helpers';
import { MyComponent } from '@/components/MyComponent';

describe('MyComponent', () => {
  it('renders correctly', () => {
    render(<MyComponent />);
    expect(screen.getByText('Hello')).toBeInTheDocument();
  });

  it('handles user interaction', async () => {
    const user = userEvent.setup();
    render(<MyComponent />);

    await user.click(screen.getByRole('button', { name: 'Click me' }));

    expect(screen.getByText('Clicked!')).toBeInTheDocument();
  });
});
```

### Frontend Hook Tests

```typescript
import { renderHook, act } from '@testing-library/react';
import { useMyHook } from '@/hooks/useMyHook';

describe('useMyHook', () => {
  it('returns initial state', () => {
    const { result } = renderHook(() => useMyHook());

    expect(result.current.value).toBe(0);
  });

  it('updates state correctly', () => {
    const { result } = renderHook(() => useMyHook());

    act(() => {
      result.current.increment();
    });

    expect(result.current.value).toBe(1);
  });
});
```

### Backend Unit Tests

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_function_name() {
        let input = "test";
        let result = my_function(input);

        assert_eq!(result, expected_value);
    }

    #[test]
    fn test_error_handling() {
        let result = my_function_that_fails();

        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("expected error"));
    }
}
```

### Backend Async Tests

```rust
#[tokio::test]
async fn test_async_function() {
    let result = my_async_function().await;

    assert!(result.is_ok());
    assert_eq!(result.unwrap(), expected_value);
}
```

## Test Utilities

### Frontend Test Helpers

```typescript
// Use test helpers for consistent rendering
import { renderWithProviders, createMockProject } from '@/__tests__/utils/test-helpers';

test('component with context', () => {
  const mockProject = createMockProject({ name: 'Test' });

  renderWithProviders(<MyComponent project={mockProject} />);

  expect(screen.getByText('Test')).toBeInTheDocument();
});
```

### Mocking Tauri Commands

```typescript
import { mockInvoke, setupMockInvoke } from '@/__mocks__/tauri';

beforeEach(() => {
  setupMockInvoke();
});

test('calls Tauri command', async () => {
  mockInvoke.mockResolvedValueOnce({ id: 1, name: 'Project' });

  // Your test code that calls invoke('get_project', { id: 1 })

  expect(mockInvoke).toHaveBeenCalledWith('get_project', { id: 1 });
});
```

### Backend Test Utilities

```rust
use crate::test_utils::{create_temp_dir, create_mock_project};

#[tokio::test]
async fn test_database_operation() {
    let temp_dir = create_temp_dir();
    let db = Database::new_with_path(&temp_dir.path().join("test.db")).unwrap();

    let project = create_mock_project("Test", "Description");
    let created = db.create_project(project).await.unwrap();

    assert_eq!(created.name, "Test");
}
```

## Mocking External APIs

### AssemblyAI Mock Responses

```rust
use crate::test_utils::mock_apis::assemblyai;

#[test]
fn test_with_mock_assemblyai() {
    let begin_msg = assemblyai::create_begin_message("session-123");
    let turn_msg = assemblyai::create_turn_message(1, "Hello world", true);

    // Use these mock messages in your tests
}
```

### Claude API Mock Responses

```rust
use crate::test_utils::mock_apis::claude;

#[test]
fn test_with_mock_claude() {
    let response = claude::create_enhancement_response("Enhanced text here");

    // Use this mock response in your tests
}
```

## Testing Best Practices

### 1. Test Organization (AAA Pattern)

```typescript
test('descriptive test name', () => {
  // Arrange: Setup test data and conditions
  const input = 'test data';
  const expected = 'expected result';

  // Act: Execute the code under test
  const result = functionUnderTest(input);

  // Assert: Verify the results
  expect(result).toBe(expected);
});
```

### 2. Descriptive Test Names

```typescript
// Good: Describes what is being tested and expected behavior
test('displays error message when API key is invalid', () => {});

// Bad: Vague or implementation-focused
test('test error', () => {});
test('sets error state to true', () => {});
```

### 3. Test User Behavior, Not Implementation

```typescript
// Good: Tests user-visible behavior
test('shows loading spinner while fetching data', async () => {
  render(<MyComponent />);

  expect(screen.getByRole('progressbar')).toBeInTheDocument();

  await waitFor(() => {
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });
});

// Bad: Tests internal implementation
test('sets loading state to true', () => {
  const { result } = renderHook(() => useMyHook());
  expect(result.current.isLoading).toBe(true);
});
```

### 4. Isolate Tests

```typescript
beforeEach(() => {
  // Reset state before each test
  cleanup();
  resetTauriMocks();
});

test('independent test 1', () => {
  // This test doesn't affect others
});

test('independent test 2', () => {
  // This test doesn't depend on test 1
});
```

### 5. Use Realistic Test Data

```typescript
// Good: Realistic data that matches production
const mockProject = createMockProject({
  name: 'Q4 2024 Product Launch',
  description: 'Planning and execution for major product release',
});

// Bad: Minimal or unrealistic data
const mockProject = { name: 'Test', description: 'Test' };
```

## Performance Testing

### Running Benchmarks

```bash
# Run all benchmarks
cd src-tauri && cargo bench

# Run specific benchmark
cd src-tauri && cargo bench -- buffer_creation

# Generate HTML report
cd src-tauri && cargo bench
# Open target/criterion/report/index.html
```

### Writing Benchmarks

```rust
use criterion::{black_box, criterion_group, criterion_main, Criterion};

fn bench_my_function(c: &mut Criterion) {
    c.bench_function("my_function", |b| {
        b.iter(|| {
            my_function(black_box(input_data))
        });
    });
}

criterion_group!(benches, bench_my_function);
criterion_main!(benches);
```

## Continuous Integration

### GitHub Actions Workflow

Tests run automatically on:
- Push to `main` or `develop` branches
- Pull requests to `main` or `develop`

### Coverage Reports

Coverage reports are uploaded to Codecov:
- Frontend coverage: Vitest with v8 provider
- Backend coverage: cargo-tarpaulin (Linux only)

View coverage at: https://codecov.io/gh/your-org/causal

### Quality Gates

CI will fail if:
- Any test fails
- Frontend coverage < 80%
- Backend coverage < 85%
- TypeScript type checking fails
- Build fails

## Troubleshooting

### Tests Timing Out

```typescript
// Increase timeout for slow operations
test('slow operation', async () => {
  // ...
}, 10000); // 10 second timeout
```

```rust
// For async Rust tests
#[tokio::test(flavor = "multi_thread", worker_threads = 1)]
async fn test_slow_operation() {
    // ...
}
```

### Flaky Tests

1. **Identify**: Run tests multiple times
   ```bash
   npm run test:run -- --reporter=verbose --repeat=10
   ```

2. **Fix**: Common causes
   - Race conditions (use `waitFor`, `act`)
   - Shared state between tests (use `beforeEach`)
   - Time-dependent tests (mock timers)

3. **Report**: Create issue with reproduction steps

### Mock Not Working

```typescript
// Ensure mocks are setup before imports
vi.mock('@tauri-apps/api/core');

// Then import components that use the mocked module
import { MyComponent } from '@/components/MyComponent';
```

### Database Tests Failing

```rust
// Ensure using temporary database
use tempfile::tempdir;

let temp_dir = tempdir().unwrap();
let db_path = temp_dir.path().join("test.db");
let db = Database::new_with_path(&db_path).unwrap();
```

## Test Coverage Goals

| Layer | Current | Target |
|-------|---------|--------|
| Frontend Components | 0% | 80% |
| Frontend Hooks | 0% | 85% |
| Frontend Contexts | 0% | 75% |
| Backend Database | ~20% | 85% |
| Backend Transcription | ~15% | 85% |
| Backend Encryption | 100% | 100% |
| Integration | 0% | 100% |

## Next Steps

1. **Write more tests**: Focus on critical paths first
2. **Improve coverage**: Aim for 80%+ across the board
3. **Add E2E tests**: Automate user workflows
4. **Performance benchmarks**: Establish baselines
5. **Reduce flakiness**: Make tests more reliable

## Resources

- [Vitest Documentation](https://vitest.dev)
- [React Testing Library](https://testing-library.com/react)
- [Rust Testing Book](https://doc.rust-lang.org/book/ch11-00-testing.html)
- [Playwright Documentation](https://playwright.dev)
- [Testing Strategy](./TESTING_STRATEGY.md)

---

**Last Updated**: 2025-11-05
**Maintained By**: Development Team
