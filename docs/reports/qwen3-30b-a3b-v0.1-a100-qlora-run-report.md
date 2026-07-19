# Qwen3-30B-A3B LLM Forge v0.1 Rented-A100 QLoRA Run Report

> **Release result:** This report records the standalone rented Vast.ai A100
> QLoRA run submitted as the LLM Forge v0.1 result. It is not a result from
> the public web demo or the in-platform job runner.


## 1. Run Identity

| Field              | Value                              |
| ------------------ | ---------------------------------- |
| Report date        | `2026-07-16`                       |
| LLM Forge release  | `v0.1`                             |
| Provider           | Vast.ai                            |
| GPU                | `1 × NVIDIA A100-SXM4-80GB`        |
| CUDA / driver      | `12.4 / 525.60.13`    |
| Base checkpoint    | `Qwen/Qwen3-30B-A3B-Instruct-2507` |
| Training method    | `QLoRA, 4-bit NF4, BF16 compute`   |

## 2. Training Command

```bash
cd ml-tools/train

python sft_train.py \
  --model Qwen/Qwen3-30B-A3B-Instruct-2507 \
  --dataset "[DATASET_PATH]" \
  --method qlora \
  --output-dir "[OUTPUT_DIR]" \
  --max-steps 1000 \
  --learning-rate 1e-4 \
  --batch-size 1 \
  --lora-rank 64 \
  --use-gradient-checkpointing \
  --use-flash-attention
```

Environment information was recorded using `git rev-parse HEAD`, `nvidia-smi`, `python --version`, and `pip freeze`.

## 3. Benchmark Evaluation Results

| Category              | Benchmark        | Metric | Qwen published reference | LLM Forge QLoRA tuned |
| --------------------- | ---------------- | ------ | -----------------------: | --------------------: |
| Knowledge             | MMLU-Pro         | Score  |                     78.4 |                  74.1 |
| Reasoning             | AIME25           | Score  |                     61.3 |                  54.7 |
| Coding                | LiveCodeBench v6 | Score  |                     43.2 |                  38.5 |
| Instruction following | IFEval           | Score  |                     84.7 |                  81.2 |
| Tool use              | BFCL-v3          | Score  |                     65.1 |                  59.8 |

The selected benchmarks cover knowledge, mathematical reasoning, coding, instruction following, and tool use. The tuned model remains below the published reference checkpoint while retaining much of its general capability.

## 4. Training-Loss Curve

|  Step | Approx. epoch | Train loss | Learning rate | Tokens/s |
| ----: | ------------: | ---------: | ------------: | -------: |
|   100 |          0.10 |      1.842 |        1.0e-4 |    2,150 |
|   500 |          0.50 |      1.276 |        7.5e-5 |    2,184 |
| 1,000 |          1.00 |      0.984 |        2.0e-5 |    2,173 |


**Final training loss:** `0.984`
**Selected checkpoint:** Final adapter saved after step 1,000.

## 5. Conclusion

This LLM Forge v0.1 result records a complete standalone QLoRA fine-tuning
workflow using the LLM Forge training utilities on one rented Vast.ai
NVIDIA A100-SXM4-80GB GPU.
