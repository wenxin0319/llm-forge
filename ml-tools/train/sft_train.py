#!/usr/bin/env python3
"""
Native HuggingFace supervised fine-tuning script — full fine-tune, LoRA,
QLoRA, or prefix-tuning, selected by --method. Built directly on trl's
SFTTrainer (HF's own canonical SFT script) plus peft for the parameter-
efficient methods, exactly as the "Training execution" roadmap item calls
for: real transformers/peft/bitsandbytes, no simulation.

CLI flags mirror TrainingConfigDto in src/training/training.dto.ts one-to-one
so the backend can shell out to this script with the wizard's config
unchanged. See README.md for the full field mapping and for what's been
verified on CPU vs. what genuinely requires a CUDA GPU (QLoRA, Flash
Attention 2).

Example (tiny smoke test, runs anywhere):
    python sft_train.py --model Qwen/Qwen3-0.6B --dataset ./sample.jsonl \\
        --method lora --output-dir ./out/smoke --max-steps 2 --batch-size 1
"""
import argparse

import torch
from transformers import AutoModelForCausalLM, AutoTokenizer
from trl import SFTConfig, SFTTrainer

from data import load_sft_dataset
from metrics_callback import MetricPointCallback


def build_peft_config(method: str, lora_rank: int):
    if method == "full_fine_tune":
        return None
    if method in ("lora", "qlora"):
        from peft import LoraConfig

        return LoraConfig(
            r=lora_rank,
            lora_alpha=lora_rank * 2,
            lora_dropout=0.05,
            bias="none",
            task_type="CAUSAL_LM",
        )
    if method == "prefix_tuning":
        from peft import PrefixTuningConfig

        return PrefixTuningConfig(task_type="CAUSAL_LM", num_virtual_tokens=30)
    raise ValueError(f"Unknown method: {method}")


def build_quantization_config(method: str):
    if method != "qlora":
        return None
    if not torch.cuda.is_available():
        raise RuntimeError(
            "QLoRA requires bitsandbytes 4-bit quantization, which requires a CUDA GPU. "
            "This machine has none — run this on the rented GPU instance, or use --method lora "
            "for a quantization-free approximation."
        )
    from transformers import BitsAndBytesConfig

    return BitsAndBytesConfig(
        load_in_4bit=True,
        bnb_4bit_quant_type="nf4",
        bnb_4bit_compute_dtype=torch.bfloat16,
        bnb_4bit_use_double_quant=True,
    )


def resolve_attn_implementation(use_flash_attention: bool) -> str:
    if use_flash_attention and torch.cuda.is_available():
        try:
            import flash_attn  # noqa: F401

            return "flash_attention_2"
        except ImportError:
            print("[sft_train] --use-flash-attention set but flash-attn isn't installed; falling back to sdpa")
    return "sdpa"


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--model", required=True, help="HF repo id or local path (TrainingConfigDto.modelId)")
    ap.add_argument("--dataset", required=True, help="Path to a local JSONL file (chat or alpaca schema)")
    ap.add_argument("--method", required=True, choices=["full_fine_tune", "lora", "qlora", "prefix_tuning"])
    ap.add_argument("--output-dir", required=True)
    ap.add_argument("--epochs", type=float, default=3)
    ap.add_argument("--learning-rate", type=float, default=2e-4)
    ap.add_argument("--batch-size", type=int, default=8)
    ap.add_argument("--lora-rank", type=int, default=16)
    ap.add_argument("--use-flash-attention", action="store_true")
    ap.add_argument("--use-gradient-checkpointing", action="store_true")
    ap.add_argument("--max-steps", type=int, default=-1, help="Cap steps — mainly for smoke-testing this script")
    ap.add_argument("--max-seq-length", type=int, default=1024)
    args = ap.parse_args()

    dataset = load_sft_dataset(args.dataset)
    print(f"[sft_train] Loaded {len(dataset)} examples from {args.dataset}")

    tokenizer = AutoTokenizer.from_pretrained(args.model)
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token

    quant_config = build_quantization_config(args.method)
    dtype = torch.bfloat16 if torch.cuda.is_available() else torch.float32
    model = AutoModelForCausalLM.from_pretrained(
        args.model,
        quantization_config=quant_config,
        dtype=dtype,
        attn_implementation=resolve_attn_implementation(args.use_flash_attention),
    )

    peft_config = build_peft_config(args.method, args.lora_rank)
    if args.method == "qlora":
        from peft import prepare_model_for_kbit_training

        model = prepare_model_for_kbit_training(model)

    sft_config = SFTConfig(
        output_dir=args.output_dir,
        num_train_epochs=args.epochs,
        max_steps=args.max_steps,
        per_device_train_batch_size=args.batch_size,
        learning_rate=args.learning_rate,
        gradient_checkpointing=args.use_gradient_checkpointing,
        max_length=args.max_seq_length,
        logging_steps=1,
        include_num_input_tokens_seen=True,
        report_to="none",
        bf16=torch.cuda.is_available(),
    )

    trainer = SFTTrainer(
        model=model,
        args=sft_config,
        train_dataset=dataset,
        peft_config=peft_config,
        processing_class=tokenizer,
        callbacks=[MetricPointCallback(f"{args.output_dir}/metrics.jsonl")],
    )

    print(f"[sft_train] method={args.method} trainable params:")
    trainer.model.print_trainable_parameters() if hasattr(trainer.model, "print_trainable_parameters") else None

    trainer.train()
    trainer.save_model(args.output_dir)
    tokenizer.save_pretrained(args.output_dir)
    print(f"[sft_train] Done. Model + adapters saved to {args.output_dir}")
    print(f"[sft_train] Real per-step metrics logged to {args.output_dir}/metrics.jsonl")


if __name__ == "__main__":
    main()
