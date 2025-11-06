import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useLoadingState } from "@/hooks/use-loading-state";

describe("useLoadingState", () => {
  it("initializes with not loading state", () => {
    const { result } = renderHook(() => useLoadingState());

    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("sets loading state correctly", () => {
    const { result } = renderHook(() => useLoadingState());

    act(() => {
      result.current.setLoading(true);
    });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.error).toBeNull();
  });

  it("sets error state correctly", () => {
    const { result } = renderHook(() => useLoadingState());
    const testError = "Test error message";

    act(() => {
      result.current.setError(testError);
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBe(testError);
  });

  it("clears error when setting loading to true", () => {
    const { result } = renderHook(() => useLoadingState());

    act(() => {
      result.current.setError("Initial error");
    });

    expect(result.current.error).toBe("Initial error");

    act(() => {
      result.current.setLoading(true);
    });

    expect(result.current.error).toBeNull();
  });

  it("wraps async operation successfully", async () => {
    const { result } = renderHook(() => useLoadingState());
    const mockAsyncFn = vi.fn().mockResolvedValue("success");

    let returnValue: string | undefined;

    await act(async () => {
      returnValue = await result.current.withLoading(mockAsyncFn);
    });

    expect(mockAsyncFn).toHaveBeenCalled();
    expect(returnValue).toBe("success");
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("handles async operation errors", async () => {
    const { result } = renderHook(() => useLoadingState());
    const testError = new Error("Async error");
    const mockAsyncFn = vi.fn().mockRejectedValue(testError);

    await act(async () => {
      await result.current.withLoading(mockAsyncFn);
    });

    expect(mockAsyncFn).toHaveBeenCalled();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBe("Async error");
  });

  it("resets state correctly", () => {
    const { result } = renderHook(() => useLoadingState());

    act(() => {
      result.current.setLoading(true);
      result.current.setError("Test error");
    });

    act(() => {
      result.current.reset();
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });
});
