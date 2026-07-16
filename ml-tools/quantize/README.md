# bf16_to_fp8 — naive precision-cast quantizer

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
