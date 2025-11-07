/// Vector similarity computation for semantic search
///
/// Provides efficient cosine similarity calculations and top-k
/// similarity search functionality for embeddings.

use rayon::prelude::*;
use tracing::{debug, info};

/// Compute cosine similarity between two embedding vectors
///
/// # Arguments
/// * `a` - First embedding vector
/// * `b` - Second embedding vector
///
/// # Returns
/// Similarity score between 0.0 (dissimilar) and 1.0 (identical)
pub fn cosine_similarity(a: &[f32], b: &[f32]) -> f32 {
    if a.len() != b.len() {
        return 0.0;
    }

    let dot_product: f32 = a.iter()
        .zip(b.iter())
        .map(|(x, y)| x * y)
        .sum();

    let norm_a: f32 = a.iter().map(|x| x * x).sum::<f32>().sqrt();
    let norm_b: f32 = b.iter().map(|x| x * x).sum::<f32>().sqrt();

    if norm_a == 0.0 || norm_b == 0.0 {
        0.0
    } else {
        // Clamp to [-1.0, 1.0] to handle floating point errors
        (dot_product / (norm_a * norm_b)).max(-1.0).min(1.0)
    }
}

/// Find the top-k most similar embeddings from a collection
///
/// # Arguments
/// * `query` - Query embedding vector
/// * `candidates` - Vector of (id, embedding) tuples to search
/// * `top_k` - Number of top results to return
/// * `min_similarity` - Minimum similarity threshold (0.0 to 1.0)
///
/// # Returns
/// Vector of (id, similarity_score) tuples, sorted by similarity descending
pub fn find_similar<T: Clone + Send + Sync>(
    query: &[f32],
    candidates: &[(T, Vec<f32>)],
    top_k: usize,
    min_similarity: f32,
) -> Vec<(T, f32)> {
    let start_time = std::time::Instant::now();
    debug!("Similarity: Computing similarities for {} candidates (top_k: {}, min_similarity: {})",
           candidates.len(), top_k, min_similarity);

    // Compute similarities in parallel for better performance
    let compute_start = std::time::Instant::now();
    let mut similarities: Vec<(T, f32)> = candidates
        .par_iter()
        .map(|(id, embedding)| {
            let similarity = cosine_similarity(query, embedding);
            (id.clone(), similarity)
        })
        .filter(|(_, similarity)| *similarity >= min_similarity)
        .collect();
    let compute_duration = compute_start.elapsed();

    let matches_before_filter = similarities.len();
    debug!("Similarity: Computed {} similarities in {:?} ({} above threshold)",
           candidates.len(), compute_duration, matches_before_filter);

    // Sort by similarity descending
    let sort_start = std::time::Instant::now();
    similarities.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal));
    let sort_duration = sort_start.elapsed();

    // Take top-k results
    similarities.truncate(top_k);

    let total_duration = start_time.elapsed();
    if !similarities.is_empty() {
        let scores: Vec<f32> = similarities.iter().map(|(_, s)| *s).collect();
        let avg_score = scores.iter().sum::<f32>() / scores.len() as f32;
        info!("Similarity: Found {} top matches in {:?} (compute: {:?}, sort: {:?}) - avg_score: {:.3}, scores: {:?}",
              similarities.len(), total_duration, compute_duration, sort_duration, avg_score,
              scores.iter().map(|s| format!("{:.3}", s)).collect::<Vec<_>>());
    } else {
        info!("Similarity: No matches found above threshold in {:?}", total_duration);
    }

    similarities
}

/// Compute pairwise similarities between all embeddings in a batch
///
/// # Arguments
/// * `embeddings` - Vector of embeddings
///
/// # Returns
/// 2D vector of similarity scores
#[allow(dead_code)]
pub fn pairwise_similarities(embeddings: &[Vec<f32>]) -> Vec<Vec<f32>> {
    embeddings
        .par_iter()
        .map(|query| {
            embeddings
                .iter()
                .map(|candidate| cosine_similarity(query, candidate))
                .collect()
        })
        .collect()
}

/// Find embeddings within a similarity threshold
///
/// # Arguments
/// * `query` - Query embedding vector
/// * `candidates` - Vector of (id, embedding) tuples to search
/// * `threshold` - Minimum similarity threshold
///
/// # Returns
/// All candidates above the threshold, sorted by similarity
#[allow(dead_code)]
pub fn find_above_threshold<T: Clone + Send + Sync>(
    query: &[f32],
    candidates: &[(T, Vec<f32>)],
    threshold: f32,
) -> Vec<(T, f32)> {
    let mut results: Vec<(T, f32)> = candidates
        .par_iter()
        .map(|(id, embedding)| {
            let similarity = cosine_similarity(query, embedding);
            (id.clone(), similarity)
        })
        .filter(|(_, similarity)| *similarity >= threshold)
        .collect();

    // Sort by similarity descending
    results.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal));

    results
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_cosine_similarity_identical() {
        let a = vec![1.0, 0.0, 0.0];
        let b = vec![1.0, 0.0, 0.0];
        let similarity = cosine_similarity(&a, &b);
        assert!((similarity - 1.0).abs() < 1e-6);
    }

    #[test]
    fn test_cosine_similarity_orthogonal() {
        let a = vec![1.0, 0.0, 0.0];
        let b = vec![0.0, 1.0, 0.0];
        let similarity = cosine_similarity(&a, &b);
        assert!((similarity - 0.0).abs() < 1e-6);
    }

    #[test]
    fn test_cosine_similarity_opposite() {
        let a = vec![1.0, 0.0, 0.0];
        let b = vec![-1.0, 0.0, 0.0];
        let similarity = cosine_similarity(&a, &b);
        assert!((similarity + 1.0).abs() < 1e-6);
    }

    #[test]
    fn test_find_similar() {
        let query = vec![1.0, 0.0, 0.0];
        let candidates = vec![
            ("a", vec![1.0, 0.0, 0.0]),
            ("b", vec![0.8, 0.2, 0.0]),
            ("c", vec![0.0, 1.0, 0.0]),
            ("d", vec![0.6, 0.8, 0.0]),
        ];

        let results = find_similar(&query, &candidates, 2, 0.5);

        assert_eq!(results.len(), 2);
        assert_eq!(results[0].0, "a"); // Most similar
        assert!(results[0].1 > 0.9);
    }

    #[test]
    fn test_pairwise_similarities() {
        let embeddings = vec![
            vec![1.0, 0.0, 0.0],
            vec![0.0, 1.0, 0.0],
            vec![1.0, 0.0, 0.0],
        ];

        let similarities = pairwise_similarities(&embeddings);

        assert_eq!(similarities.len(), 3);
        assert_eq!(similarities[0].len(), 3);

        // Check diagonal (self-similarity should be 1.0)
        assert!((similarities[0][0] - 1.0).abs() < 1e-6);
        assert!((similarities[1][1] - 1.0).abs() < 1e-6);

        // Check symmetry
        assert!((similarities[0][1] - similarities[1][0]).abs() < 1e-6);

        // Check identical embeddings
        assert!((similarities[0][2] - 1.0).abs() < 1e-6);
    }

    #[test]
    fn test_find_above_threshold() {
        let query = vec![1.0, 0.0, 0.0];
        let candidates = vec![
            ("a", vec![1.0, 0.0, 0.0]),
            ("b", vec![0.8, 0.2, 0.0]),
            ("c", vec![0.0, 1.0, 0.0]),
        ];

        let results = find_above_threshold(&query, &candidates, 0.7);

        assert_eq!(results.len(), 2); // Only "a" and "b" are above threshold
        assert_eq!(results[0].0, "a");
    }

    #[test]
    fn test_cosine_similarity_different_lengths() {
        let a = vec![1.0, 0.0];
        let b = vec![1.0, 0.0, 0.0];
        let similarity = cosine_similarity(&a, &b);
        assert_eq!(similarity, 0.0); // Different lengths should return 0
    }

    #[test]
    fn test_cosine_similarity_zero_vector() {
        let a = vec![0.0, 0.0, 0.0];
        let b = vec![1.0, 0.0, 0.0];
        let similarity = cosine_similarity(&a, &b);
        assert_eq!(similarity, 0.0); // Zero vector should return 0
    }
}
