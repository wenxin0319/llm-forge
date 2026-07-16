#!/usr/bin/env python3
"""
Naive precision-cast quantizer: converts every floating-point tensor in a
safetensors checkpoint to FP8 (E4M3), elementwise, no calibration.

This is the simplest possible "transform": read each weight, round it to
the nearest representable FP8 E4M3 value, write it back at half (from
BF16/FP16) or a quarter (from FP32) the storage size. No activation
scaling, no per-channel scales, no outlier handling — real quantizers
(AutoFP8, etc.) do all of that; this is the floor case the user asked for.

Usage:
    python bf16_to_fp8.py --repo Qwen/Qwen3-0.6B --out ./out/qwen3-0.6b-fp8
    python bf16_to_fp8.py --model-dir ./some/local/model --out ./out/converted
"""
import argparse
import json
import shutil
from pathlib import Path

import torch
from safetensors import safe_open
from safetensors.torch import save_file

FP8_DTYPE = torch.float8_e4m3fn

# Tensors below this rank are almost always norms/biases/embeddings-adjacent
# scalars where FP8's ~2-3 bits of mantissa does the most relative damage
# for the least size benefit; skip them like every real quantizer does.
MIN_QUANTIZE_NDIM = 2


def convert_tensor_to_fp8(tensor: torch.Tensor) -> torch.Tensor:
    """The transform itself: elementwise cast to FP8 E4M3.

    FP8 E4M3 range is [-448, 448]; values are clamped before casting so
    out-of-range weights saturate instead of becoming inf.
    """
    if tensor.dtype == FP8_DTYPE:
        return tensor
    fp32 = tensor.to(torch.float32)
    clamped = fp32.clamp(min=-448.0, max=448.0)
    return clamped.to(FP8_DTYPE)


def should_quantize(name: str, tensor: torch.Tensor) -> bool:
    if not tensor.is_floating_point():
        return False
    if tensor.dtype == FP8_DTYPE:
        return False
    if tensor.dim() < MIN_QUANTIZE_NDIM:
        return False
    return True


def convert_checkpoint(src_file: Path, dst_file: Path) -> dict:
    tensors = {}
    quantized_bytes_before = 0
    quantized_bytes_after = 0
    skipped_bytes = 0
    n_quantized = 0
    n_skipped = 0

    with safe_open(str(src_file), framework="pt") as f:
        for name in f.keys():
            t = f.get_tensor(name)
            if should_quantize(name, t):
                before = t.numel() * t.element_size()
                new_t = convert_tensor_to_fp8(t)
                after = new_t.numel() * new_t.element_size()
                tensors[name] = new_t
                quantized_bytes_before += before
                quantized_bytes_after += after
                n_quantized += 1
            else:
                tensors[name] = t
                skipped_bytes += t.numel() * t.element_size()
                n_skipped += 1

    dst_file.parent.mkdir(parents=True, exist_ok=True)
    save_file(tensors, str(dst_file), metadata={"format": "pt"})

    return {
        "tensors_quantized": n_quantized,
        "tensors_skipped": n_skipped,
        "quantized_bytes_before": quantized_bytes_before,
        "quantized_bytes_after": quantized_bytes_after,
        "skipped_bytes_unchanged": skipped_bytes,
    }


def human(n: int) -> str:
    for unit in ("B", "KB", "MB", "GB"):
        if n < 1024:
            return f"{n:.1f} {unit}"
        n /= 1024
    return f"{n:.1f} TB"


def resolve_model_dir(args) -> Path:
    if args.model_dir:
        return Path(args.model_dir)
    from huggingface_hub import snapshot_download

    print(f"Downloading {args.repo} from HuggingFace...")
    path = snapshot_download(repo_id=args.repo, allow_patterns=["*.safetensors", "*.json", "*.txt"])
    return Path(path)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--repo", help="HuggingFace repo id to download, e.g. Qwen/Qwen3-0.6B")
    ap.add_argument("--model-dir", help="Local directory with an existing checkpoint instead of --repo")
    ap.add_argument("--out", required=True, help="Output directory for the converted checkpoint")
    args = ap.parse_args()

    if not args.repo and not args.model_dir:
        ap.error("one of --repo or --model-dir is required")

    src_dir = resolve_model_dir(args)
    out_dir = Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)

    safetensor_files = sorted(src_dir.glob("*.safetensors"))
    if not safetensor_files:
        raise SystemExit(f"No .safetensors files found in {src_dir}")

    total_before = 0
    total_after = 0
    totals = {"tensors_quantized": 0, "tensors_skipped": 0, "quantized_bytes_before": 0, "quantized_bytes_after": 0, "skipped_bytes_unchanged": 0}

    for src_file in safetensor_files:
        dst_file = out_dir / src_file.name
        print(f"Converting {src_file.name} ...")
        stats = convert_checkpoint(src_file, dst_file)
        for k in totals:
            totals[k] += stats[k]
        total_before += src_file.stat().st_size
        total_after += dst_file.stat().st_size

    # Carry over everything else (config, tokenizer) so the output dir is a
    # loadable model, not just a bag of tensors.
    for f in src_dir.iterdir():
        if f.suffix != ".safetensors" and f.is_file():
            shutil.copy2(f, out_dir / f.name)

    print()
    print("=== Conversion summary ===")
    print(f"Source input dtype seen         : {'mixed' if totals['tensors_skipped'] else 'quantized'}")
    print(f"Tensors quantized to FP8 (E4M3) : {totals['tensors_quantized']}")
    print(f"Tensors left unchanged          : {totals['tensors_skipped']} (norms/1-D params)")
    print(f"Quantized-tensor bytes          : {human(totals['quantized_bytes_before'])} -> {human(totals['quantized_bytes_after'])} "
          f"({totals['quantized_bytes_before'] / max(totals['quantized_bytes_after'], 1):.2f}x)")
    print(f"On-disk checkpoint size         : {human(total_before)} -> {human(total_after)} ({total_before / total_after:.2f}x)")
    print(f"Output written to               : {out_dir}")


if __name__ == "__main__":
    main()
