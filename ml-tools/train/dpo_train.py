#!/usr/bin/env python3
"""
Native HuggingFace DPO (Direct Preference Optimization) training script,
built on trl's DPOTrainer — the "DPO" leg of the roadmap item alongside
LoRA/QLoRA. Takes a prompt/chosen/rejected JSONL preference dataset; the
website's DPO detection today only checks for prompt+chosen (see
detectFormat in the finetune wizard), which isn't actually a usable DPO
dataset without a rejected completion — this script requires all three and
fails loudly rather than pretending two-field data is a preference pair.

Example (tiny smoke test, runs anywhere):
    python dpo_train.py --model Qwen/Qwen3-0.6B --dataset ./prefs.jsonl \\
        --method lora --output-dir ./out/dpo-smoke --max-steps 2 --batch-size 1
"""
import argparse

import torch
from transformers import AutoModelForCausalLM, AutoTokenizer
from trl import DPOConfig, DPOTrainer

from data import load_dpo_dataset
from metrics_callback import MetricPointCallback
from sft_train import build_peft_config, build_quantization_config, resolve_attn_implementation


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--model", required=True, help="Policy model to align — usually an already-SFT'd checkpoint")
    ap.add_argument("--dataset", required=True, help="Path to a local JSONL file with prompt/chosen/rejected")
    ap.add_argument("--method", default="lora", choices=["full_fine_tune", "lora", "qlora"])
    ap.add_argument("--output-dir", required=True)
    ap.add_argument("--epochs", type=float, default=1)
    ap.add_argument("--learning-rate", type=float, default=5e-6)
    ap.add_argument("--batch-size", type=int, default=4)
    ap.add_argument("--lora-rank", type=int, default=16)
    ap.add_argument("--beta", type=float, default=0.1, help="DPO temperature — how strongly to penalize dispreferred completions")
    ap.add_argument("--use-flash-attention", action="store_true")
    ap.add_argument("--use-gradient-checkpointing", action="store_true")
    ap.add_argument("--max-steps", type=int, default=-1)
    ap.add_argument("--max-seq-length", type=int, default=1024)
    args = ap.parse_args()

    dataset = load_dpo_dataset(args.dataset)
    print(f"[dpo_train] Loaded {len(dataset)} preference pairs from {args.dataset}")

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

    dpo_config = DPOConfig(
        output_dir=args.output_dir,
        num_train_epochs=args.epochs,
        max_steps=args.max_steps,
        per_device_train_batch_size=args.batch_size,
        learning_rate=args.learning_rate,
        gradient_checkpointing=args.use_gradient_checkpointing,
        max_length=args.max_seq_length,
        beta=args.beta,
        logging_steps=1,
        report_to="none",
        bf16=torch.cuda.is_available(),
    )

    trainer = DPOTrainer(
        model=model,
        args=dpo_config,
        train_dataset=dataset,
        processing_class=tokenizer,
        peft_config=peft_config,
        callbacks=[MetricPointCallback(f"{args.output_dir}/metrics.jsonl")],
    )

    trainer.train()
    trainer.save_model(args.output_dir)
    tokenizer.save_pretrained(args.output_dir)
    print(f"[dpo_train] Done. Model + adapters saved to {args.output_dir}")
    print(f"[dpo_train] Real per-step metrics logged to {args.output_dir}/metrics.jsonl")


if __name__ == "__main__":
    main()
