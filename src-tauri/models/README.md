# Embedding Models Directory

This directory should contain the ONNX embedding model files for local vector embeddings.

## Required Files

1. **all-MiniLM-L6-v2.onnx** - The ONNX format model file
2. **tokenizer.json** - The tokenizer configuration

## Obtaining the Models

### Option 1: Download Pre-converted ONNX Model

Download from Hugging Face or other sources that provide ONNX-converted sentence-transformers models.

### Option 2: Convert from PyTorch

```python
from sentence_transformers import SentenceTransformer
from optimum.onnxruntime import ORTModelForFeatureExtraction
from transformers import AutoTokenizer

# Load the model
model_name = "sentence-transformers/all-MiniLM-L6-v2"
model = SentenceTransformer(model_name)

# Export to ONNX
model.save("./model_export", safe_serialization=False)

# Convert to ONNX using optimum
ort_model = ORTModelForFeatureExtraction.from_pretrained(
    model_name,
    export=True,
    provider="CPUExecutionProvider"
)
ort_model.save_pretrained("./onnx_model")

# Copy the files:
# - model.onnx -> all-MiniLM-L6-v2.onnx
# - tokenizer.json -> tokenizer.json
```

## Model Specifications

- **Model**: sentence-transformers/all-MiniLM-L6-v2
- **Dimensions**: 384
- **Max Sequence Length**: 256 tokens
- **File Size**: ~23MB (ONNX format)
- **License**: Apache 2.0

## Integration

The model files should be bundled with the Tauri application during build:

```json
{
  "bundle": {
    "resources": [
      "models/all-MiniLM-L6-v2.onnx",
      "models/tokenizer.json"
    ]
  }
}
```

## Development

For development without the actual model files, the embeddings system will gracefully fail with appropriate error messages directing to this README.
