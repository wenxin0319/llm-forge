# Qwen3-30B-A3B LLM Forge QLoRA Run Report Template

> Status: **Template — run not yet executed.** Blank fields must be completed
> from the future CUDA run. Published Qwen scores are provided only as
> external reference baselines; they are not measurements produced by LLM
> Forge.

## 1. Run identity

| Field | Value |
|---|---|
| Report date | `[YYYY-MM-DD]` |
| LLM Forge commit before run | `[git commit hash]` |
| LLM Forge commit containing results | `[git commit hash]` |
| Operator | `[name]` |
| Provider | `[Vast.ai / RunPod / other]` |
| Instance / contract ID | `[provider instance ID]` |
| Region | `[region]` |
| GPU model and count | `[for example: 1× NVIDIA A100-SXM4-80GB]` |
| CUDA / driver | `[versions]` |
| PyTorch / Transformers / TRL / PEFT / bitsandbytes | `[versions]` |
| Base checkpoint | `Qwen/Qwen3-30B-A3B-Instruct-2507` |
| Base checkpoint revision | `[immutable Hugging Face revision SHA]` |
| Training method | `QLoRA (NF4 base, BF16 compute)` |
| Dataset | `[repository path or immutable dataset revision]` |
| Dataset license | `[license]` |
| Train / validation records | `[count] / [count]` |
| Output adapter path | `[path or object-storage URI]` |
| Adapter SHA-256 | `[checksum]` |

## 2. Exact commands

Record commands exactly as executed. Do not include tokens, API keys, or
other secrets.

### Environment and hardware capture

```bash
git rev-parse HEAD
nvidia-smi
python --version
pip freeze
```

### Training

```bash
cd ml-tools/train

python sft_train.py \
  --model Qwen/Qwen3-30B-A3B-Instruct-2507 \
  --dataset '[DATASET_PATH]' \
  --method qlora \
  --output-dir '[OUTPUT_DIR]' \
  --epochs '[EPOCHS]' \
  --learning-rate '[LEARNING_RATE]' \
  --batch-size '[BATCH_SIZE]' \
  --lora-rank '[LORA_RANK]' \
  --use-gradient-checkpointing \
  --use-flash-attention
```

> Before running, verify that the script targets all intended linear layers,
> including the MoE expert projections, and record the trainable-parameter
> report here: `[trainable parameters / total parameters / percentage]`.

### Evaluation

```bash
# Paste the exact lm-evaluation-harness or project evaluation commands here.
[EVALUATION_COMMANDS]
```

## 3. Training configuration

| Parameter | Value |
|---|---:|
| NF4 double quantization | `true` |
| Compute dtype | `bfloat16` |
| LoRA rank | `[value]` |
| LoRA alpha | `[value]` |
| LoRA dropout | `[value]` |
| Target modules | `[exact module list]` |
| Router trained? | `[yes/no]` |
| Epochs | `[value]` |
| Micro batch size | `[value]` |
| Gradient accumulation | `[value]` |
| Effective batch size | `[value]` |
| Maximum sequence length | `[tokens]` |
| Learning rate / scheduler | `[value] / [scheduler]` |
| Warmup | `[steps or ratio]` |
| Optimizer | `[optimizer]` |
| Gradient checkpointing | `[true/false]` |
| Flash Attention | `[version or disabled]` |
| Random seed | `[value]` |

## 4. Quality: original baseline vs. LLM Forge tuned

The “Qwen published reference” column comes from the official
[Qwen3-30B-A3B-Instruct-2507 model card](https://huggingface.co/Qwen/Qwen3-30B-A3B-Instruct-2507).
It is useful for orientation but is not a controlled baseline unless the
same evaluation harness, dataset revision, prompt format, decoding settings,
and sample count are reproduced. The primary comparison for this experiment
is **local base vs. local tuned**.

| Category | Benchmark | Metric | Qwen published reference | Local base checkpoint | LLM Forge QLoRA tuned | Tuned − local base |
|---|---|---|---:|---:|---:|---:|
| Knowledge | MMLU-Pro | Score | 78.4 | `[blank]` | `[blank]` | `[blank]` |
| Knowledge | MMLU-Redux | Score | 89.3 | `[blank]` | `[blank]` | `[blank]` |
| Knowledge | GPQA | Score | 70.4 | `[blank]` | `[blank]` | `[blank]` |
| Knowledge | SuperGPQA | Score | 53.4 | `[blank]` | `[blank]` | `[blank]` |
| Reasoning | AIME25 | Score | 61.3 | `[blank]` | `[blank]` | `[blank]` |
| Reasoning | HMMT25 | Score | 43.0 | `[blank]` | `[blank]` | `[blank]` |
| Reasoning | ZebraLogic | Score | 90.0 | `[blank]` | `[blank]` | `[blank]` |
| Reasoning | LiveBench 2024-11-25 | Score | 69.0 | `[blank]` | `[blank]` | `[blank]` |
| Coding | LiveCodeBench v6 (2025-02–05) | Score | 43.2 | `[blank]` | `[blank]` | `[blank]` |
| Coding | MultiPL-E | Score | 83.8 | `[blank]` | `[blank]` | `[blank]` |
| Coding | Aider-Polyglot | Score | 35.6 | `[blank]` | `[blank]` | `[blank]` |
| Alignment | IFEval | Score | 84.7 | `[blank]` | `[blank]` | `[blank]` |
| Alignment | Arena-Hard v2 | Win rate | 69.0 | `[blank]` | `[blank]` | `[blank]` |
| Alignment | Creative Writing v3 | Score | 86.0 | `[blank]` | `[blank]` | `[blank]` |
| Agent | BFCL-v3 | Score | 65.1 | `[blank]` | `[blank]` | `[blank]` |
| Agent | TAU1-Retail | Score | 59.1 | `[blank]` | `[blank]` | `[blank]` |
| Agent | TAU2-Airline | Score | 38.0 | `[blank]` | `[blank]` | `[blank]` |
| Multilingual | MMLU-ProX | Score | 72.0 | `[blank]` | `[blank]` | `[blank]` |
| Multilingual | PolyMATH | Score | 43.1 | `[blank]` | `[blank]` | `[blank]` |
| Domain-specific | `[benchmark name]` | `[metric]` | N/A | `[blank]` | `[blank]` | `[blank]` |

### Required evaluation controls

| Control | Recorded value |
|---|---|
| Evaluation harness and commit | `[name + commit SHA]` |
| Dataset revisions | `[immutable revisions]` |
| Chat template | `[template/revision]` |
| Thinking mode | `disabled (Instruct-2507)` |
| Few-shot count per benchmark | `[values]` |
| Temperature / top-p | `[values]` |
| Maximum generated tokens | `[value]` |
| Seeds / repeated runs | `[values and count]` |
| Confidence intervals | `[method and results]` |

## 5. Training performance and cost

| Measurement | Estimator prediction | Actual CUDA run | Error |
|---|---:|---:|---:|
| GPU count | `[blank]` | `[blank]` | `[blank]` |
| Peak memory per GPU | `[blank] GB` | `[blank] GB` | `[blank]%` |
| Average GPU utilization | N/A | `[blank]%` | N/A |
| Average tokens/s | `[blank]` | `[blank]` | `[blank]%` |
| Training steps | `[blank]` | `[blank]` | `[blank]` |
| Training duration | `[blank]` | `[blank]` | `[blank]%` |
| GPU-hours | `[blank]` | `[blank]` | `[blank]%` |
| Provider rate | `[blank] $/GPU-hour` | `[blank] $/GPU-hour` | `[blank]%` |
| Compute cost | `[blank] USD` | `[blank] USD` | `[blank]%` |
| Storage / egress cost | `[blank] USD` | `[blank] USD` | `[blank]%` |
| Total cost | `[blank] USD` | `[blank] USD` | `[blank]%` |

Provider cost evidence: `[invoice screenshot path or provider billing export,
with account identifiers redacted]`.

## 6. Loss curve

Source file: `[OUTPUT_DIR]/metrics.jsonl`

| Step | Epoch | Train loss | Validation loss | Learning rate | Tokens/s | GPU memory GB |
|---:|---:|---:|---:|---:|---:|---:|
| `[blank]` | `[blank]` | `[blank]` | `[blank]` | `[blank]` | `[blank]` | `[blank]` |
| `[blank]` | `[blank]` | `[blank]` | `[blank]` | `[blank]` | `[blank]` | `[blank]` |
| `[blank]` | `[blank]` | `[blank]` | `[blank]` | `[blank]` | `[blank]` | `[blank]` |

Loss-curve image: `[relative path to PNG/SVG]`

Final train loss: `[blank]`  
Final validation loss: `[blank]`  
Best checkpoint and selection rule: `[blank]`

## 7. Output adapter verification

| Check | Result |
|---|---|
| `adapter_config.json` exists | `[pass/fail]` |
| `adapter_model.safetensors` exists | `[pass/fail]` |
| Adapter size | `[bytes / MiB]` |
| SHA-256 | `[hash]` |
| Clean reload with PEFT | `[pass/fail + command]` |
| Held-out prompt generation | `[pass/fail + output path]` |
| Base model unchanged | `[pass/fail + revision check]` |
| Secrets absent from logs/artifacts | `[pass/fail]` |

## 8. Raw evidence inventory

All evidence should be committed when small and free of secrets; large model
artifacts should be stored externally with checksums.

| Evidence | Location | SHA-256 / commit |
|---|---|---|
| Training stdout/stderr | `[path]` | `[hash]` |
| `metrics.jsonl` | `[path]` | `[hash]` |
| `nvidia-smi` samples | `[path]` | `[hash]` |
| Resolved training config | `[path]` | `[hash]` |
| Evaluation outputs | `[path]` | `[hash]` |
| Loss-curve image | `[path]` | `[hash]` |
| Adapter artifact | `[URI]` | `[hash]` |
| Billing export | `[redacted path]` | `[hash]` |
| Results commit | repository | `[commit SHA]` |

## 9. Acceptance decision

| Gate | Threshold | Result | Pass? |
|---|---|---|---|
| Training completed without NaN/Inf | Required | `[blank]` | `[blank]` |
| Adapter reloads and generates | Required | `[blank]` | `[blank]` |
| Domain quality improvement | `[define before run]` | `[blank]` | `[blank]` |
| General quality regression | `≤ [define]% relative` | `[blank]` | `[blank]` |
| Peak memory within estimator | `≤ [define]% error` | `[blank]` | `[blank]` |
| Cost within estimate | `≤ [define]% error` | `[blank]` | `[blank]` |
| Evidence complete and reproducible | Required | `[blank]` | `[blank]` |

Decision: `[ACCEPT / REJECT / NEEDS ANOTHER RUN]`

## 10. Conclusion (complete after the run)

> On `[GPU]`, LLM Forge fine-tuned
> `Qwen/Qwen3-30B-A3B-Instruct-2507` with QLoRA on `[dataset]` in
> `[duration]`, using `[peak memory]` peak GPU memory and `[GPU-hours]`
> GPU-hours at a total cost of `[cost]`. Compared with the locally reproduced
> base checkpoint, the tuned adapter changed `[primary metric]` from
> `[baseline]` to `[tuned]` (`[delta]`) while changing the general benchmark
> average by `[delta]`. The run `[met/did not meet]` the predefined acceptance
> criteria. Raw evidence is recorded at `[paths]` and the immutable results
> commit is `[SHA]`.

Do not replace blanks with estimates. If a measurement is unavailable, use
`not measured` and explain why.
