#!/usr/bin/env python3
"""
Real GGUF export + quantization using llama.cpp's own conversion script and
compiled llama-quantize binary — the "Artifact export & quantization"
roadmap item's GGUF half. Two real steps, not a size estimate:

  1. convert_hf_to_gguf.py: HF safetensors -> GGUF F16 (llama.cpp's own script)
  2. llama-quantize:        GGUF F16 -> a real K-quant (e.g. Q4_K_M)

Run ./setup.sh first to clone + build llama.cpp locally (not vendored into
git — see README.md).

Usage:
    python convert_to_gguf.py --repo Qwen/Qwen3-0.6B --out ./out/qwen3-0.6b --quant Q4_K_M
    python convert_to_gguf.py --model-dir ./some/local/model --out ./out/converted --quant Q4_K_M
"""
import argparse
import subprocess
from pathlib import Path

HERE = Path(__file__).parent
LLAMA_CPP = HERE / "vendor-llama-cpp"
QUANTIZE_BIN = LLAMA_CPP / "build" / "bin" / "llama-quantize"
CONVERT_SCRIPT = LLAMA_CPP / "convert_hf_to_gguf.py"


def human(n: int) -> str:
    f = float(n)
    for unit in ("B", "KB", "MB", "GB"):
        if f < 1024:
            return f"{f:.1f} {unit}"
        f /= 1024
    return f"{f:.1f} TB"


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
    ap.add_argument("--out", required=True, help="Output path prefix (no extension)")
    ap.add_argument("--quant", default="Q4_K_M", help="llama-quantize target type (Q4_K_M, Q5_K_M, Q8_0, ...)")
    args = ap.parse_args()

    if not args.repo and not args.model_dir:
        ap.error("one of --repo or --model-dir is required")
    if not QUANTIZE_BIN.exists() or not CONVERT_SCRIPT.exists():
        raise SystemExit("llama.cpp not set up — run ./setup.sh first")

    src_dir = resolve_model_dir(args)
    out_prefix = Path(args.out)
    out_prefix.parent.mkdir(parents=True, exist_ok=True)
    f16_path = out_prefix.with_name(out_prefix.name + "-f16.gguf")
    quant_path = out_prefix.with_name(f"{out_prefix.name}-{args.quant.lower()}.gguf")

    print(f"[1/2] Converting {src_dir} -> {f16_path} (F16 GGUF)")
    subprocess.run(
        ["python3", str(CONVERT_SCRIPT), "--outfile", str(f16_path), "--outtype", "f16", str(src_dir)],
        check=True,
    )

    print(f"[2/2] Quantizing {f16_path} -> {quant_path} ({args.quant})")
    subprocess.run([str(QUANTIZE_BIN), str(f16_path), str(quant_path), args.quant], check=True)

    f16_size = f16_path.stat().st_size
    quant_size = quant_path.stat().st_size
    print()
    print("=== Conversion summary ===")
    print(f"F16 GGUF   : {human(f16_size)}  ({f16_path})")
    print(f"{args.quant:10} : {human(quant_size)}  ({quant_path})  {f16_size / quant_size:.2f}x smaller than F16")


if __name__ == "__main__":
    main()
