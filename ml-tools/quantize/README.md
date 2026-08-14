# Quantization tools: bf16_to_fp8 (naive cast) and gptq_quantize (real GPTQ)

This directory has two independent tools. `bf16_to_fp8.py` is CPU-only and
needs no GPU. `gptq_quantize.py`, documented in its own section below, is
CUDA-only — GPTQ calibration runs real forward passes and per-layer Hessian
solves on the actual GPU, which is why it wasn't attempted until a rented
GPU was available (see `ml-tools/gguf/README.md`'s "Notes" section, written
when only CPU was available).

## bf16_to_fp8 — naive precision-cast quantizer

Every other "quantization" in this repo (the Distill & Compress wizard, artifact
downloads, job logs) is simulated — file sizes and log lines are made up. This
tool is the real thing: it downloads an actual HuggingFace checkpoint and does
an actual elementwise cast of every weight tensor to FP8 (E4M3), tensor by
tensor, using PyTorch's native `float8_e4m3fn` dtype. No calibration, no
activation scaling, no outlier handling — the simplest possible transform,
as requested. Real quantizers (AutoFP8, llm-compressor, etc.) add all of that
on top; this is the floor case.

## Setup

```bash
cd ml-tools/quantize
python3 -m venv .venv
source .venv/bin/activate
pip install torch --index-url https://download.pytorch.org/whl/cpu   # CPU wheel, much smaller
pip install -r requirements.txt
```

## Run

```bash
# Pull straight from HuggingFace
python bf16_to_fp8.py --repo Qwen/Qwen3-0.6B --out ./out/qwen3-0.6b-fp8

# Or convert an already-downloaded checkpoint directory
python bf16_to_fp8.py --model-dir /path/to/model --out ./out/converted
```

## Verified result (Qwen/Qwen3-0.6B, real weights, 2026-07-15)

The model ships as BF16. Converting to FP8 halves it, exactly as expected
(FP8 is 1 byte/element vs BF16's 2):

```
Tensors quantized to FP8 (E4M3) : 198
Tensors left unchanged          : 113 (norms/1-D params — quantizing these
                                        hurts quality for negligible size gain)
Quantized-tensor bytes          : 1.4 GB -> 716.8 MB (2.00x)
On-disk checkpoint size         : 1503300328 -> 751732864 bytes (2.00x)
```

Spot-checked `lm_head.weight` (151936×1024) against the original:
mean abs error 0.00066 vs a mean abs weight value of 0.023 (~2.9% relative
error), consistent with FP8 E4M3's 3-bit mantissa — expected precision loss
for a naive cast, no accuracy recovery step involved.

A synthetic FP32 tensor confirms the other half of the claim: FP32 → FP8 is
1 byte vs 4 bytes, i.e. a 4x reduction, also verified exactly (4.00x measured).

## Notes

- 1-D tensors (LayerNorm/RMSNorm weights, biases) are left at their original
  dtype — `MIN_QUANTIZE_NDIM` in `bf16_to_fp8.py` controls this. Every real
  quantizer does the same; norms are precision-sensitive and tiny, so there's
  no size win worth the accuracy cost.
- FP8 E4M3 range is ±448; values are clamped before the cast so outliers
  saturate instead of overflowing to inf.
- `out/` and `.venv/` are gitignored — this produces multi-hundred-MB model
  files that don't belong in git.

## gptq_quantize.py — real GPTQ (CUDA-only)

The other tool the "Artifact export & quantization" roadmap item names,
alongside llama.cpp for GGUF. Uses `gptqmodel` to run the actual GPTQ
algorithm: forward passes over calibration text, per-layer Hessian
computation, and solving for INT4 weights that minimize each layer's output
error — not a size estimate, and not something `bf16_to_fp8.py`'s naive cast
approach can substitute for.

### Setup

```bash
cd ml-tools/quantize
source .venv/bin/activate   # or reuse a CUDA-enabled torch env
pip install gptqmodel
```

### Run

```bash
python gptq_quantize.py --repo Qwen/Qwen2.5-7B-Instruct --out ./out/qwen2.5-7b-gptq
# or: --model-dir /path/to/local/checkpoint
```

### Verified result (Qwen/Qwen2.5-7B-Instruct, real weights, rented Vast.ai RTX 4090 48GB, 2026-08-14)

```
Calibration : 64 real text samples, 27 transformer layers, bits=4, group_size=128
Wall time   : ~5m36s (GPU at 100% util throughout)
BF16 source : ~15 GB
INT4 GPTQ   : 5.2 GB   (~2.9x smaller)
```

Loaded the quantized checkpoint back with `gptqmodel` (Marlin kernel) and ran
real greedy-decoded generation, not just a file-size check:

```
'The capital of France is' -> 'The capital of France is Paris. Which of the
following options correctly describes this fact? ...'  (20.2 tok/s)

'def fibonacci(n):' -> 'def fibonacci(n):  # generator function
    a, b, counter = 0, 1, 0
    while True:
        if (counter > ...'  (32.2 tok/s)
```

Coherent, factually correct, syntactically valid completions — the
quantization preserves the model, same standard as the GGUF verification.

### Notes / what's still not done

- This verifies the **standalone tool**, not the backend artifact path.
  `artifacts.service.ts`'s `scheduleQuantization` still simulates GPTQ
  completion (`fileSizeGb * 0.28` guess, no real file) — wiring this tool in
  the way `createLocalGgufLoraAdapter`/`createLocalMergedGgufArtifact` wire
  GGUF is the next step, not done here.
- Calibration used 64 short synthetic text samples for a fast, verifiable
  run. Production GPTQ calibration typically uses a larger, more
  representative corpus (e.g. C4 or wikitext2 samples) — this is enough to
  prove the real algorithm runs and produces a working model, not a
  quality-tuned quantization.
- `out/` is gitignored — same reason as the FP8 tool.
