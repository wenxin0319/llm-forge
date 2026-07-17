#!/usr/bin/env bash
# Clones llama.cpp and builds the two binaries this tool needs
# (llama-quantize, llama-simple). Not vendored into git — ~200MB C++ project,
# rebuilt locally instead. Idempotent: safe to re-run.
set -euo pipefail
cd "$(dirname "$0")"

if [ ! -d vendor-llama-cpp ]; then
  git clone --depth 1 https://github.com/ggml-org/llama.cpp.git vendor-llama-cpp
fi

cmake -B vendor-llama-cpp/build -S vendor-llama-cpp -DCMAKE_BUILD_TYPE=Release -DLLAMA_CURL=OFF
cmake --build vendor-llama-cpp/build --target llama-quantize llama-simple -j"$(sysctl -n hw.ncpu 2>/dev/null || nproc)"

python3 -m venv .venv
source .venv/bin/activate
pip install -q --upgrade pip
pip install -q -r vendor-llama-cpp/requirements/requirements-convert_hf_to_gguf.txt

echo "Setup complete. Binaries at vendor-llama-cpp/build/bin/{llama-quantize,llama-simple}"
