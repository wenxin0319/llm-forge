# convert_to_gguf.py — real GGUF export + quantization

The "Artifact export & quantization" roadmap item calls for real quantization
tooling — llama.cpp for GGUF — replacing `artifacts.service.ts`'s current
behavior, which fabricates a GGUF artifact at a hardcoded 22% of the merged
size with no file ever produced. This tool does the real two-step llama.cpp
pipeline: convert HF safetensors to F16 GGUF, then quantize with the actual
compiled `llama-quantize` binary — not a size estimate.

## Setup

```bash
cd ml-tools/gguf
./setup.sh   # clones llama.cpp (not vendored into git, ~200MB) and builds
             # llama-quantize + llama-simple, plus a venv with the
             # conversion script's Python deps
```

## Run

```bash
source .venv/bin/activate
python convert_to_gguf.py --repo Qwen/Qwen3-0.6B --out ./out/qwen3-0.6b --quant Q4_K_M
# or: --model-dir /path/to/local/checkpoint
```

## Verified result (Qwen/Qwen3-0.6B, real weights, 2026-07-16)

```
F16 GGUF   : 1.4 GB
Q4_K_M     : 461.8 MB   (3.12x smaller than F16)
```

Then actually ran the quantized model (`llama-simple`, real inference, not
just a file-size check):

```
$ llama-simple -m out/qwen3-0.6b-q4_k_m.gguf -n 20 "The capital of France is"
The capital of France is Paris, and the capital of the United States is
Washington, D.C. ...
68.5 tokens/sec (CPU)

$ llama-simple -m out/qwen3-0.6b-q4_k_m.gguf -n 15 "2 + 2 ="
2 + 2 = 4 \Rightarrow 4 = 4 \Rightarrow \text{True
67.8 tokens/sec (CPU)
```

Coherent, factually correct completions from the quantized model — the
conversion preserves the model, not just shrinks the file.

## Notes / what's still not done

- **AutoGPTQ** (the other tool the roadmap item names) isn't included here.
  GPTQ calibration is a CUDA-only workload in practice; there was nothing to
  verify on this CPU machine the way GGUF/llama.cpp could be. If GPTQ output
  is needed, `optimum`'s `GPTQQuantizer` or `gptqmodel` are the current
  native HF-ecosystem tools — same shape as this script, but needs an actual
  GPU to write and verify honestly rather than shipping unverified.
- **Real object storage for downloads** (the other half of this roadmap
  item) isn't addressed here either — that's a backend/infra change
  (`artifacts.service.ts` currently returns `downloadUrl: '#'`), not a
  conversion-tooling one. Separate piece of work.
- `vendor-llama-cpp/` and `.venv/` are gitignored — `setup.sh` rebuilds both
  locally.
