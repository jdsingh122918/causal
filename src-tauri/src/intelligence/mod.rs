/// AI-powered Business Intelligence Module
///
/// This module provides a multi-agent system for real-time business intelligence
/// analysis of transcription data. It works alongside the existing enhancement
/// system to provide specialized analysis for different business contexts.
///
/// Architecture:
/// - Multiple specialized AI agents running in parallel
/// - Each agent focuses on specific analysis types (sentiment, financial, competitive)
/// - Pluggable agent system that can be extended with new analysis types
/// - Integrates with existing parallel processing infrastructure
/// - Real-time processing during live events (earnings calls, meetings)

pub mod agents;
pub mod commands;
pub mod coordinator;
pub mod types;

pub use agents::*;
pub use commands::*;
pub use coordinator::*;
pub use types::*;