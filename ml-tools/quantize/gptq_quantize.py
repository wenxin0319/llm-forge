#!/usr/bin/env python3
"""
Real GPTQ quantization via gptqmodel — the "Artifact export & quantization"
roadmap item's other named tool (alongside llama.cpp for GGUF, see
ml-tools/gguf/). GPTQ calibration is a real CUDA workload: it runs the model
forward over calibration text, computes per-layer Hessians, and solves for
INT4 weights that minimize the layer's output error — not a size estimate,
and not something that can be verified without a GPU (see
ml-tools/gguf/README.md's "Notes" section, which is why GPTQ wasn't attempted
there).

Usage:
    python gptq_quantize.py --repo Qwen/Qwen2.5-7B-Instruct --out ./out/qwen2.5-7b-gptq
    python gptq_quantize.py --model-dir /path/to/local/checkpoint --out ./out/converted
"""
import argparse
from pathlib import Path


def human(n: int) -> str:
    f = float(n)
    for unit in ("B", "KB", "MB", "GB"):
        if f < 1024:
            return f"{f:.1f} {unit}"
        f /= 1024
    return f"{f:.1f} TB"


def dir_size(path: Path) -> int:
    return sum(f.stat().st_size for f in path.rglob("*") if f.is_file())


CALIBRATION_TEXTS = [
    "The quick brown fox jumps over the lazy dog while the sun sets over the hills.",
    "In machine learning, quantization reduces the numerical precision of model weights to save memory.",
    "The history of the Roman Empire spans centuries of conquest, governance, and cultural exchange.",
    "Photosynthesis is the process by which plants convert sunlight into chemical energy.",
    "The stock market fluctuated today as investors weighed inflation data against corporate earnings.",
    "A well-designed API should be intuitive, consistent, and documented clearly for developers.",
    "Climate change is driving shifts in weather patterns across the globe, affecting agriculture.",
    "The novel's protagonist embarks on a journey of self-discovery through a series of trials.",
    "Deep neural networks learn hierarchical representations of data through layered transformations.",
    "The recipe calls for two cups of flour, a teaspoon of salt, and three eggs, whisked together.",
    "International trade agreements shape the flow of goods and services between nations.",
    "The orchestra performed a symphony that moved the audience to a standing ovation.",
    "Software engineers write unit tests to catch regressions before they reach production.",
    "The mountain range stretches for hundreds of miles, home to diverse wildlife and ecosystems.",
    "Quantum computing promises to solve certain problems exponentially faster than classical computers.",
    "The committee debated the proposal for hours before reaching a narrow consensus.",
] * 4  # 64 short samples — real calibration passes, small enough to verify on one GPU


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--repo", help="HuggingFace repo id to load, e.g. Qwen/Qwen2.5-7B-Instruct")
    ap.add_argument("--model-dir", help="Local directory with an existing checkpoint instead of --repo")
    ap.add_argument("--out", required=True, help="Output directory for the quantized model")
    ap.add_argument("--bits", type=int, default=4, help="GPTQ target bit width (default 4)")
    ap.add_argument("--group-size", type=int, default=128, help="GPTQ group size (default 128)")
    args = ap.parse_args()

    if not args.repo and not args.model_dir:
        ap.error("one of --repo or --model-dir is required")

    from gptqmodel import GPTQModel, QuantizeConfig

    src = args.model_dir or args.repo
    out_dir = Path(args.out)
    out_dir.parent.mkdir(parents=True, exist_ok=True)

    print(f"[1/3] Loading {src} in preparation for GPTQ calibration...")
    quant_config = QuantizeConfig(bits=args.bits, group_size=args.group_size)
    model = GPTQModel.load(src, quant_config)

    print(f"[2/3] Running real GPTQ calibration over {len(CALIBRATION_TEXTS)} text samples "
          f"(forward passes + per-layer Hessian solve, bits={args.bits}, group_size={args.group_size})...")
    model.quantize(CALIBRATION_TEXTS)

    print(f"[3/3] Saving quantized checkpoint to {out_dir}")
    model.save(str(out_dir))

    quant_size = dir_size(out_dir)
    print()
    print("=== Quantization summary ===")
    print(f"INT{args.bits} GPTQ : {human(quant_size)}  ({out_dir})")


if __name__ == "__main__":
    main()
