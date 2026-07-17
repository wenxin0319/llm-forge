# sft_train.py / dpo_train.py — real HuggingFace training scripts

The website's "Training execution" is still simulated end to end: `jobs.service.ts`
runs a chain of `setTimeout`s that push fabricated log lines and
`Math.random()`-based loss curves, and no GPU is ever provisioned. These two
scripts are the real thing they're standing in for — built directly on
`trl.SFTTrainer` / `trl.DPOTrainer`, HuggingFace's own canonical training
loops, plus `peft` for LoRA/QLoRA/prefix-tuning and `bitsandbytes` for 4-bit
quantization. No hand-rolled training loop — this is the same
`transformers`/`trl`/`peft` stack and API surface real fine-tuning jobs use.

They are **not** wired into the backend or run against rented GPUs. That's
deliberate — provisioning cloud GPUs is a real spending decision, out of
scope until asked for. What's here is verified correct and ready to run the
moment a GPU (or patience, for tiny jobs) is available.

## Setup

```bash
cd ml-tools/train
python3 -m venv .venv
source .venv/bin/activate
pip install torch --index-url https://download.pytorch.org/whl/cpu   # or the CUDA wheel on a GPU box
pip install -r requirements.txt
pip install bitsandbytes   # only if you need --method qlora, and only works on CUDA
```

## Scripts

- `sft_train.py` — supervised fine-tuning. `--method full_fine_tune|lora|qlora|prefix_tuning`.
- `dpo_train.py` — preference optimization via `trl.DPOTrainer`. `--method full_fine_tune|lora|qlora`.
- `data.py` — converts the three dataset schemas the website already detects
  (`nextjs-frontend/src/app/finetune/page.tsx` `detectFormat`, `src/datasets/dataset-parsers.ts`)
  into what trl expects natively: chat (`messages`) and alpaca
  (`instruction`/`output`) become a `messages` column for SFT; DPO requires
  `prompt`/`chosen`/`rejected` — the website's own DPO detection only checks
  for `prompt`+`chosen`, which is incomplete for real DPO, so this loader
  fails loudly instead of training on rejected-less "preference" data.
- `metrics_callback.py` — a `TrainerCallback` that writes real per-step
  metrics to `<output-dir>/metrics.jsonl`, one line per logged step, in
  **exactly** the `MetricPoint` shape `jobs.service.ts` already defines:
  `step, epoch, timestampMs, trainLoss, valLoss, learningRate, tokensPerSec,
  stepsPerSec, gpuUtilPct, gpuMemUsedGb`. `gpuUtilPct`/`gpuMemUsedGb` are left
  empty — that's real `nvidia-smi`/DCGM telemetry, a separate roadmap item,
  not something the Trainer itself knows.

## Wizard config → CLI flags

`TrainingConfigDto` (`src/training/training.dto.ts`) maps 1:1:

| DTO field | CLI flag |
|---|---|
| `modelId` | `--model` |
| (resolved dataset file path) | `--dataset` |
| `method` | `--method` |
| `epochs` | `--epochs` |
| `learningRate` | `--learning-rate` |
| `batchSize` | `--batch-size` |
| `loraRank` | `--lora-rank` |
| `useFlashAttention` | `--use-flash-attention` |
| `useGradientCheckpointing` | `--use-gradient-checkpointing` |

To actually wire this into `jobs.service.ts`, `simulateTraining` would shell
out to one of these scripts on the provisioned GPU instance instead of the
`setTimeout` chain, tail `metrics.jsonl` and append each line straight into
the job's `metrics` array, and tail stdout for `logs`. That's a job-runner /
GPU-provisioning problem (SSH to a rented box, or a queue like Modal/RunPod),
not a training-script problem — everything on the training side is ready.

## Verified (2026-07-16, CPU, macOS, Qwen/Qwen3-0.6B unless noted)

All four `sft_train.py` methods and `dpo_train.py` were run end-to-end
against real JSONL fixtures (alpaca and chat schema for SFT,
prompt/chosen/rejected for DPO) with `--max-steps 2`:

- **LoRA** — real adapter (0.38% of 598M params trainable), loss 5.05 → 4.03
  over 2 steps, `adapter_model.safetensors` + `adapter_config.json` saved.
- **Prefix tuning** — real trainable prefix (0.29% of params), loss
  16.03 → 13.82, chat-format dataset (`messages` column, chat-template
  applied by trl automatically).
- **Full fine-tune** — verified the no-`peft_config` code path on a
  tiny random-weight Qwen2.5 checkpoint (`yujiepan/qwen2.5-tiny-random`) since
  full fine-tuning even a 0.6B model's optimizer state on CPU is impractically
  slow — loss 21.22 → 20.41 over 2 steps, all params updated, full model
  (not an adapter) saved.
- **DPO + LoRA** — real `trl.DPOTrainer` run, loss ≈ ln(2) ≈ 0.693 at
  initialization (expected — reward margins start near zero), real
  `rewards/chosen`, `rewards/rejected`, `rewards/margins`,
  `rewards/accuracies` logged.
- **QLoRA guard** — confirmed `--method qlora` fails fast with a clear error
  on this CPU machine instead of silently training unquantized (bitsandbytes
  4-bit needs CUDA); the same run would need an actual CUDA GPU to verify the
  quantized path itself.
- **`metrics.jsonl`** output shape spot-checked against `MetricPoint` in
  `jobs.service.ts` — field names and types match exactly.

Not verified here (needs a real CUDA GPU): QLoRA's actual 4-bit quantized
training path, Flash Attention 2 (the `flash-attn` package doesn't build on
CPU/macOS; the scripts fall back to `sdpa` and print a warning rather than
silently ignoring the flag), and anything at a scale where CPU training time
would be prohibitive.
