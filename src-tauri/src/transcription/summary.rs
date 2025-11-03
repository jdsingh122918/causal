use chrono::Utc;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TranscriptSummary {
    pub summary: String,
    pub key_points: Vec<String>,
    pub action_items: Vec<String>,
    pub metadata: SummaryMetadata,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SummaryMetadata {
    pub duration_seconds: f64,
    pub chunk_count: u32,
    pub word_count: usize,
    pub timestamp: String,
}

#[derive(Debug, Serialize)]
struct ClaudeRequest {
    model: String,
    max_tokens: u32,
    messages: Vec<ClaudeMessage>,
}

#[derive(Debug, Serialize)]
struct ClaudeMessage {
    role: String,
    content: String,
}

#[derive(Debug, Deserialize)]
struct ClaudeResponse {
    content: Vec<ClaudeContent>,
}

#[derive(Debug, Deserialize)]
struct ClaudeContent {
    text: String,
}

pub struct SummaryService {
    api_key: String,
    client: reqwest::Client,
}

impl SummaryService {
    pub fn new(api_key: String) -> Self {
        let client = reqwest::Client::new();
        Self { api_key, client }
    }

    /// Generate a summary using Claude API
    pub async fn summarize(
        &self,
        transcript_text: String,
        chunk_count: u32,
    ) -> Result<TranscriptSummary, String> {
        let word_count = transcript_text.split_whitespace().count();

        tracing::info!(
            "📋 GENERATING SUMMARY - {} chunks, {} words, {} chars",
            chunk_count,
            word_count,
            transcript_text.len()
        );

        // Create prompt for Claude
        let prompt = format!(
            r#"You are an expert at summarizing transcripts. Please analyze the following transcript and provide:

1. A concise executive summary (2-3 paragraphs)
2. Key points (bullet points)
3. Action items (if any are mentioned)

Please format your response EXACTLY as follows:

SUMMARY:
[Your summary here]

KEY POINTS:
- [Point 1]
- [Point 2]
- [Point 3]

ACTION ITEMS:
- [Action 1]
- [Action 2]
(If no action items, write "None")

Transcript:
{}
"#,
            transcript_text
        );

        // Call Claude API
        let request = ClaudeRequest {
            model: "claude-sonnet-4-5-20250929".to_string(), // Latest Claude Sonnet 4.5
            max_tokens: 2048,
            messages: vec![ClaudeMessage {
                role: "user".to_string(),
                content: prompt,
            }],
        };

        tracing::info!("Calling Claude API for summary generation...");

        let response = self
            .client
            .post("https://api.anthropic.com/v1/messages")
            .header("x-api-key", &self.api_key)
            .header("anthropic-version", "2023-06-01")
            .header("content-type", "application/json")
            .json(&request)
            .send()
            .await
            .map_err(|e| {
                let error_msg = format!("Failed to call Claude API: {}", e);
                tracing::error!("❌ {}", error_msg);
                error_msg
            })?;

        let status = response.status();
        tracing::info!("Claude API response status: {}", status);

        if !status.is_success() {
            let error_text = response
                .text()
                .await
                .unwrap_or_else(|_| "Unknown error".to_string());
            let error_msg = format!(
                "Claude API request failed with status {}: {}",
                status, error_text
            );
            tracing::error!("❌ {}", error_msg);
            return Err(error_msg);
        }

        let claude_response: ClaudeResponse = response
            .json()
            .await
            .map_err(|e| format!("Failed to parse Claude response: {}", e))?;

        if claude_response.content.is_empty() {
            return Err("Claude API returned empty response".to_string());
        }

        let response_text = &claude_response.content[0].text;

        // Parse the structured response
        tracing::info!("Parsing Claude response...");
        let (summary, key_points, action_items) = Self::parse_claude_response(response_text)
            .map_err(|e| {
                tracing::error!("❌ Failed to parse response: {}", e);
                e
            })?;

        // Calculate duration estimate (assuming 150 words per minute average speaking rate)
        let duration_seconds = (word_count as f64 / 150.0) * 60.0;

        tracing::info!(
            "✅ SUMMARY GENERATED - {} key points, {} action items",
            key_points.len(),
            action_items.len()
        );

        Ok(TranscriptSummary {
            summary,
            key_points,
            action_items,
            metadata: SummaryMetadata {
                duration_seconds,
                chunk_count,
                word_count,
                timestamp: Utc::now().to_rfc3339(),
            },
        })
    }

    /// Parse Claude's structured response
    fn parse_claude_response(text: &str) -> Result<(String, Vec<String>, Vec<String>), String> {
        let mut summary = String::new();
        let mut key_points = Vec::new();
        let mut action_items = Vec::new();

        let mut current_section = "";

        for line in text.lines() {
            let trimmed = line.trim();

            if trimmed.starts_with("SUMMARY:") {
                current_section = "summary";
                continue;
            } else if trimmed.starts_with("KEY POINTS:") {
                current_section = "key_points";
                continue;
            } else if trimmed.starts_with("ACTION ITEMS:") {
                current_section = "action_items";
                continue;
            }

            match current_section {
                "summary" => {
                    if !trimmed.is_empty() {
                        if !summary.is_empty() {
                            summary.push('\n');
                        }
                        summary.push_str(trimmed);
                    }
                }
                "key_points" => {
                    if trimmed.starts_with('-') || trimmed.starts_with('•') {
                        let point = trimmed
                            .trim_start_matches('-')
                            .trim_start_matches('•')
                            .trim()
                            .to_string();
                        if !point.is_empty() {
                            key_points.push(point);
                        }
                    }
                }
                "action_items" => {
                    if trimmed.starts_with('-') || trimmed.starts_with('•') {
                        let item = trimmed
                            .trim_start_matches('-')
                            .trim_start_matches('•')
                            .trim()
                            .to_string();
                        if !item.is_empty() && !item.to_lowercase().contains("none") {
                            action_items.push(item);
                        }
                    } else if trimmed.to_lowercase() == "none" {
                        // No action items
                    }
                }
                _ => {}
            }
        }

        if summary.is_empty() {
            return Err("Failed to extract summary from Claude response".to_string());
        }

        Ok((summary, key_points, action_items))
    }
}
