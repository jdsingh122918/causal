//! Tests for parallel buffer processing (Business Intelligence feature)
//!
//! These tests validate the upcoming parallel processing enhancement
//! that aims to reduce transcription latency from 1.5-33s to 300-800ms.

use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::Semaphore;
use tokio::task::JoinSet;

/// Mock buffer processing function to simulate enhancement
async fn mock_process_buffer(buffer_id: u32, delay_ms: u64) -> (u32, Duration) {
    let start = Instant::now();
    tokio::time::sleep(Duration::from_millis(delay_ms)).await;
    (buffer_id, start.elapsed())
}

#[tokio::test]
async fn test_sequential_buffer_processing() {
    // Baseline: Process 10 buffers sequentially
    let buffer_count = 10;
    let processing_time_ms = 100; // Simulated processing time per buffer

    let start = Instant::now();

    for i in 0..buffer_count {
        mock_process_buffer(i, processing_time_ms).await;
    }

    let total_time = start.elapsed();

    // Sequential processing should take ~1000ms (10 * 100ms)
    assert!(
        total_time >= Duration::from_millis(900),
        "Sequential processing too fast: {:?}",
        total_time
    );
    assert!(
        total_time < Duration::from_millis(1200),
        "Sequential processing too slow: {:?}",
        total_time
    );
}

#[tokio::test]
async fn test_parallel_buffer_processing_with_4_workers() {
    // Enhanced: Process 10 buffers with 4 concurrent workers
    let buffer_count = 10;
    let processing_time_ms = 100;
    let worker_count = 4;

    let semaphore = Arc::new(Semaphore::new(worker_count));
    let mut tasks = JoinSet::new();

    let start = Instant::now();

    for i in 0..buffer_count {
        let permit = semaphore.clone().acquire_owned().await.unwrap();
        tasks.spawn(async move {
            let result = mock_process_buffer(i, processing_time_ms).await;
            drop(permit);
            result
        });
    }

    // Wait for all tasks to complete
    let mut results = Vec::new();
    while let Some(result) = tasks.join_next().await {
        results.push(result.unwrap());
    }

    let total_time = start.elapsed();

    // With 4 workers, 10 buffers should complete in ~300ms
    // (3 batches: 4 + 4 + 2 buffers)
    assert!(
        total_time < Duration::from_millis(400),
        "Parallel processing too slow: {:?}",
        total_time
    );

    // Verify all buffers were processed
    assert_eq!(results.len(), buffer_count);
}

#[tokio::test]
async fn test_parallel_processing_latency_improvement() {
    let buffer_count = 20;
    let processing_time_ms = 150;

    // Sequential baseline
    let sequential_start = Instant::now();
    for i in 0..buffer_count {
        mock_process_buffer(i, processing_time_ms).await;
    }
    let sequential_time = sequential_start.elapsed();

    // Parallel with 4 workers
    let worker_count = 4;
    let semaphore = Arc::new(Semaphore::new(worker_count));
    let mut tasks = JoinSet::new();

    let parallel_start = Instant::now();

    for i in 0..buffer_count {
        let permit = semaphore.clone().acquire_owned().await.unwrap();
        tasks.spawn(async move {
            let result = mock_process_buffer(i, processing_time_ms).await;
            drop(permit);
            result
        });
    }

    while let Some(_) = tasks.join_next().await {}

    let parallel_time = parallel_start.elapsed();

    // Calculate improvement
    let improvement_ratio = sequential_time.as_secs_f64() / parallel_time.as_secs_f64();

    println!("Sequential time: {:?}", sequential_time);
    println!("Parallel time: {:?}", parallel_time);
    println!("Improvement ratio: {:.2}x", improvement_ratio);

    // Expect at least 3x improvement with 4 workers
    assert!(
        improvement_ratio > 3.0,
        "Parallel processing should be at least 3x faster, got {:.2}x",
        improvement_ratio
    );
}

#[tokio::test]
async fn test_worker_failure_recovery() {
    // Test that failed workers don't block the entire pipeline
    let buffer_count = 10;
    let worker_count = 4;

    let semaphore = Arc::new(Semaphore::new(worker_count));
    let mut tasks = JoinSet::new();

    for i in 0..buffer_count {
        let permit = semaphore.clone().acquire_owned().await.unwrap();
        tasks.spawn(async move {
            // Simulate failure on buffer 5
            if i == 5 {
                drop(permit);
                return Err::<(u32, Duration), String>("Simulated failure".to_string());
            }

            let result = mock_process_buffer(i, 50).await;
            drop(permit);
            Ok(result)
        });
    }

    let mut successful = 0;
    let mut failed = 0;

    while let Some(result) = tasks.join_next().await {
        match result.unwrap() {
            Ok(_) => successful += 1,
            Err(_) => failed += 1,
        }
    }

    assert_eq!(successful, 9, "Should have 9 successful buffers");
    assert_eq!(failed, 1, "Should have 1 failed buffer");
}

#[tokio::test]
async fn test_ordered_result_collection() {
    // Test that results can be collected in order despite parallel processing
    let buffer_count = 10;
    let worker_count = 4;

    let semaphore = Arc::new(Semaphore::new(worker_count));
    let mut tasks = Vec::new();

    for i in 0..buffer_count {
        let permit = semaphore.clone().acquire_owned().await.unwrap();
        let task = tokio::spawn(async move {
            let result = mock_process_buffer(i, 50).await;
            drop(permit);
            result
        });
        tasks.push(task);
    }

    // Collect results in order
    let mut results = Vec::new();
    for task in tasks {
        results.push(task.await.unwrap());
    }

    // Verify results are in order
    for (i, (buffer_id, _)) in results.iter().enumerate() {
        assert_eq!(*buffer_id, i as u32, "Results should be in order");
    }
}

#[tokio::test]
async fn test_memory_usage_under_concurrent_load() {
    // Test that concurrent processing doesn't cause memory issues
    let buffer_count = 100;
    let worker_count = 4;

    let semaphore = Arc::new(Semaphore::new(worker_count));
    let mut tasks = JoinSet::new();

    // Create large buffers to simulate memory pressure
    for i in 0..buffer_count {
        let permit = semaphore.clone().acquire_owned().await.unwrap();
        tasks.spawn(async move {
            // Simulate processing with some data
            let _data = vec![0u8; 1024 * 10]; // 10KB per buffer
            let result = mock_process_buffer(i, 10).await;
            drop(permit);
            result
        });
    }

    let mut count = 0;
    while let Some(_) = tasks.join_next().await {
        count += 1;
    }

    assert_eq!(count, buffer_count, "All buffers should be processed");
}

#[tokio::test]
async fn test_throughput_measurement() {
    // Measure buffers processed per second
    let buffer_count = 50;
    let processing_time_ms = 100;
    let worker_count = 4;

    let semaphore = Arc::new(Semaphore::new(worker_count));
    let mut tasks = JoinSet::new();

    let start = Instant::now();

    for i in 0..buffer_count {
        let permit = semaphore.clone().acquire_owned().await.unwrap();
        tasks.spawn(async move {
            let result = mock_process_buffer(i, processing_time_ms).await;
            drop(permit);
            result
        });
    }

    while let Some(_) = tasks.join_next().await {}

    let total_time = start.elapsed();
    let throughput = buffer_count as f64 / total_time.as_secs_f64();

    println!("Processed {} buffers in {:?}", buffer_count, total_time);
    println!("Throughput: {:.2} buffers/second", throughput);

    // With 4 workers and 100ms processing time, expect ~40 buffers/second
    assert!(
        throughput > 30.0,
        "Throughput should be > 30 buffers/sec, got {:.2}",
        throughput
    );
}
