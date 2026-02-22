#!/bin/bash
set -e

MODEL_DIR="public/models/Xenova/all-MiniLM-L6-v2"
BASE_URL="https://huggingface.co/Xenova/all-MiniLM-L6-v2/resolve/main"

echo "Downloading model assets to $MODEL_DIR..."

# List of files to download
files=(
    "config.json"
    "tokenizer.json"
    "tokenizer_config.json"
    "special_tokens_map.json"
    "model.onnx"
    "model_quantized.onnx"
)

for file in "${files[@]}"; do
    echo "Downloading $file..."
    curl -L -o "$MODEL_DIR/$file" "$BASE_URL/$file"
done

echo "Download complete!"
