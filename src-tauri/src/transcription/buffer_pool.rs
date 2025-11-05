/// Audio buffer pool for reducing allocations in real-time audio processing
use std::sync::{Arc, Mutex};

/// Pool of reusable audio buffers to reduce allocations in real-time processing
pub struct AudioBufferPool {
    buffers: Arc<Mutex<Vec<Vec<i16>>>>,
    buffer_size: usize,
    max_pool_size: usize,
}

impl AudioBufferPool {
    /// Create a new buffer pool with the specified buffer size and max pool size
    pub fn new(buffer_size: usize, max_pool_size: usize) -> Self {
        Self {
            buffers: Arc::new(Mutex::new(Vec::with_capacity(max_pool_size))),
            buffer_size,
            max_pool_size,
        }
    }

    /// Get a buffer from the pool, or create a new one if pool is empty
    pub fn get_buffer(&self) -> Vec<i16> {
        if let Ok(mut buffers) = self.buffers.lock() {
            buffers.pop().unwrap_or_else(|| Vec::with_capacity(self.buffer_size))
        } else {
            // Mutex is poisoned, create new buffer
            Vec::with_capacity(self.buffer_size)
        }
    }

    /// Return a buffer to the pool for reuse
    pub fn return_buffer(&self, mut buffer: Vec<i16>) {
        // Clear the buffer but keep its capacity
        buffer.clear();

        // Only keep properly sized buffers and don't exceed max pool size
        if buffer.capacity() >= self.buffer_size {
            if let Ok(mut buffers) = self.buffers.lock() {
                if buffers.len() < self.max_pool_size {
                    buffers.push(buffer);
                }
                // If pool is full or buffer is wrong size, just drop it
            }
        }
    }

    /// Get statistics about the buffer pool
    #[allow(dead_code)] // Available for monitoring and debugging
    pub fn stats(&self) -> BufferPoolStats {
        if let Ok(buffers) = self.buffers.lock() {
            BufferPoolStats {
                available_buffers: buffers.len(),
                max_pool_size: self.max_pool_size,
                buffer_size: self.buffer_size,
            }
        } else {
            BufferPoolStats {
                available_buffers: 0,
                max_pool_size: self.max_pool_size,
                buffer_size: self.buffer_size,
            }
        }
    }
}

/// Statistics about buffer pool usage
#[derive(Debug, Clone)]
#[allow(dead_code)] // Available for monitoring and debugging
pub struct BufferPoolStats {
    pub available_buffers: usize,
    pub max_pool_size: usize,
    pub buffer_size: usize,
}

impl Clone for AudioBufferPool {
    fn clone(&self) -> Self {
        Self {
            buffers: Arc::clone(&self.buffers),
            buffer_size: self.buffer_size,
            max_pool_size: self.max_pool_size,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_buffer_pool_basic_usage() {
        let pool = AudioBufferPool::new(1024, 5);

        // Get a buffer
        let mut buffer = pool.get_buffer();
        assert_eq!(buffer.capacity(), 1024);

        // Use the buffer
        buffer.extend_from_slice(&[1, 2, 3, 4]);
        assert_eq!(buffer.len(), 4);

        // Return it to pool
        pool.return_buffer(buffer);

        // Stats should show 1 available buffer
        let stats = pool.stats();
        assert_eq!(stats.available_buffers, 1);

        // Get it back - should be the same buffer (cleared)
        let buffer2 = pool.get_buffer();
        assert_eq!(buffer2.len(), 0);
        assert_eq!(buffer2.capacity(), 1024);
    }

    #[test]
    fn test_buffer_pool_max_size() {
        let pool = AudioBufferPool::new(512, 2);

        // Get and return 3 buffers
        let buf1 = pool.get_buffer();
        let buf2 = pool.get_buffer();
        let buf3 = pool.get_buffer();

        pool.return_buffer(buf1);
        pool.return_buffer(buf2);
        pool.return_buffer(buf3); // This should be dropped due to max_pool_size

        let stats = pool.stats();
        assert_eq!(stats.available_buffers, 2); // Only 2 buffers kept
    }
}