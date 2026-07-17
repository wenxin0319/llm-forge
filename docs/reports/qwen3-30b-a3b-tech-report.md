# Qwen3-30B-A3B: QLoRA Fine-Tuning and NVFP4 Deployment Report

*16 July 2026 — LLM Forge engineering report*

## Executive summary

Qwen3-30B-A3B is a 30.5B-parameter mixture-of-experts (MoE) model that
activates 3.3B parameters per token. The recommended path is to fine-tune the
BF16 checkpoint with **QLoRA (NF4)**, merge the adapter back into BF16, and
then apply **NVFP4 post-training quantization (PTQ)** for Blackwell inference.
QLoRA and NVFP4 solve different problems: QLoRA lowers training memory;
NVFP4 lowers serving memory and latency.

Published open-checkpoint evidence indicates:

- **2.2–2.7x higher token generation speed** for an NVFP4 Qwen3-Coder
  30B-A3B sibling versus full precision on the same DGX Spark and vLLM setup.
- **3.3x lower model disk/GPU-memory requirement** for NVIDIA's
  Qwen3-30B-A3B NVFP4 checkpoint versus BF16.
- **1.33 points lower OpenLLM v1 average** (73.25 to 71.92), or 98.19%
  score recovery, and **2.49 points lower HumanEval_64 pass@2** (93.62 to
  91.13), or 97.34% recovery, in Red Hat's Qwen3-30B-A3B NVFP4 evaluation.

The headline conclusion is therefore supported for general and coding
workloads: NVFP4 provides a large performance improvement with a small
quality gap. It is not lossless, however; Red Hat's harder OpenLLM v2 suite
fell 3.79 points (52.78 to 48.99), so reasoning-heavy use cases need a
task-specific acceptance gate.

## 1. How we would train it

### Recommendation: QLoRA, not full fine-tuning

| Method | Frozen base | Base precision during training | Practical assessment |
|---|---|---|---|
| Full fine-tuning | No | BF16 plus gradients and optimizer states | Not recommended; several hundred GB of aggregate training memory |
| LoRA | Yes | BF16 | Strong baseline, but roughly 61 GB for weights alone before activations and adapter state |
| **QLoRA** | **Yes** | **4-bit NF4, BF16 compute** | **Recommended; lowest-cost route with LoRA-like trainable capacity** |

QLoRA keeps the pretrained model frozen in 4-bit NormalFloat (NF4), trains
small low-rank adapters, uses double quantization, and computes in BF16. This
is the memory-efficient training method introduced by the
[QLoRA paper](https://arxiv.org/abs/2305.14314). It should not be confused
with NVFP4: the former is the training representation, while the latter is
the final Blackwell serving representation.

### Proposed recipe

1. Start from `Qwen/Qwen3-30B-A3B-Instruct-2507` for a non-thinking
   assistant, or the Thinking-2507 checkpoint if long-form reasoning is the
   product requirement. Do not mix their chat templates or evaluation
   protocols.
2. Curate and deduplicate the domain SFT set; retain a fixed validation set
   and a production-like prompt set that is never used for training.
3. Run QLoRA with NF4 double quantization, BF16 compute, gradient
   checkpointing, rank 16 as the initial baseline, `lora_alpha=32`, and
   dropout 0.05. Target all linear transformer layers; PEFT's
   [QLoRA guidance](https://github.com/huggingface/peft/blob/main/docs/source/developer_guides/lora.md)
   recommends `target_modules="all-linear"` to approach full-fine-tuning
   quality. For this MoE, confirm that routed expert projections are included
   by inspecting the reported trainable modules.
4. Train for 1–3 epochs with effective batch size determined by token count,
   evaluate every fixed number of tokens, and select the checkpoint on the
   domain validation metric rather than training loss alone.
5. Optionally apply DPO after SFT if preference pairs exist. Keep this as a
   separate experiment so its quality effect is measurable.
6. Merge the selected adapter into a BF16 copy. Evaluate the merged BF16
   model first; this separates fine-tuning regressions from quantization
   regressions.
7. Quantize the merged model to NVFP4 with NVIDIA Model Optimizer using a
   representative calibration sample, then repeat the identical evaluation
   and serving benchmark. NVIDIA's open checkpoint quantizes transformer
   linear weights and activations and reports approximately 3.3x lower disk
   and GPU-memory requirements ([model card](https://huggingface.co/nvidia/Qwen3-30B-A3B-NVFP4)).

The repository already contains `trl`/PEFT/bitsandbytes SFT and DPO scripts
under `ml-tools/train/`. They support QLoRA, but only their CUDA guard—not a
real QLoRA run—has been verified locally. Before a production run, update
the current default module targeting to `all-linear`, verify expert coverage,
and run a short CUDA smoke test. The estimates and external benchmarks in
this report are not results produced by LLM Forge.

## 2. Performance speedup

**Direct answer:** the controlled full-precision-versus-NVFP4 benchmark shows
**2.18x to 2.74x higher token generation speed**, depending on concurrency.
At concurrency 1, throughput increases from 29.86 to 64.99 tokens/s
(2.18x). At concurrency 32, it increases from 8.06 to 21.75 tokens/s per
request (2.70x). Time to first token is 1.9–2.6x faster, total latency is
2.0–2.6x lower, and request throughput is 2.0–2.5x higher. These are the
report's defensible **speedup ratios**; the much larger aggregate H100/B200
numbers below are capacity measurements under different workloads, not
additional speedup ratios.

No same-checkpoint, same-hardware BF16-versus-NVFP4 benchmark was found for
the exact Instruct-2507 model. The closest controlled open result is
[OPENZEKA's Qwen3-Coder-30B-A3B-Instruct-NVFP4](https://huggingface.co/OPENZEKA/Qwen3-Coder-30B-A3B-Instruct-NVFP4),
which shares the 30B-A3B architecture. It compared full precision and NVFP4
on the same DGX Spark, vLLM runtime, ~128-token prompts, 128-token maximum
outputs, and concurrency levels 1–32.

| Concurrency | Full precision | NVFP4 | Speedup |
|---:|---:|---:|---:|
| 1 | 29.86 tokens/s | 64.99 tokens/s | **2.18x** |
| 2 | 24.16 tokens/s | 53.75 tokens/s | **2.22x** |
| 4 | 17.30 tokens/s | 42.44 tokens/s | **2.45x** |
| 8 | 12.79 tokens/s | 33.59 tokens/s | **2.63x** |
| 16 | 9.96 tokens/s | 27.29 tokens/s | **2.74x** |
| 32 | 8.06 tokens/s | 21.75 tokens/s | **2.70x** |

The same benchmark reports 2–3x lower time to first token, 50–60% lower
inter-token latency, 2–2.6x shorter total latency, and 2–2.5x higher request
throughput. These numbers are a planning proxy, not a guaranteed result for
the chosen Qwen3 checkpoint. Kernel version, context length, batch mix, and
GPU all materially affect throughput. NVFP4's native acceleration also
requires NVIDIA Blackwell; older GPUs should use a supported FP8/INT4 path
and be benchmarked separately.

### GPU comparison: V100, H100, and B200

The 2.18–2.74x result above was measured on a DGX Spark (Blackwell) and must
not be copied directly to V100 or H100. NVFP4 is a Blackwell-native Tensor
Core format. A checkpoint may be stored in four bits on older GPUs, but
without native FP4 arithmetic the runtime must dequantize it or use a
different kernel; that is not the same performance path.

| GPU | Architecture | Memory / bandwidth | Native useful precision | Qwen3-30B-A3B training | Recommended serving path |
|---|---|---|---|---|---|
| V100 | Volta | 16 or 32 GB HBM2; 0.9–1.134 TB/s | FP16 Tensor Cores; no BF16, FP8, or FP4 | QLoRA only; 32 GB is tight, so use at least 2×32 GB for useful sequence lengths | INT4 weight-only if supported, otherwise multi-GPU FP16; **do not use NVFP4 as a speed claim** |
| H100 SXM | Hopper | 80 GB HBM3; 3.35 TB/s | BF16, FP16, FP8, INT8; no native FP4 | QLoRA comfortably on one GPU; BF16 LoRA may fit only with short sequences/checkpointing and should be profiled | **FP8** on one GPU is the preferred high-throughput path; use BF16 as the quality baseline |
| B200 | Blackwell | 180 GB HBM3e; approximately 8 TB/s per GPU | BF16, FP8, **FP4/NVFP4** | QLoRA or BF16 LoRA on one GPU; best of the three for long context and large batches | **NVFP4** with TensorRT-LLM or a runtime with native ModelOpt FP4 kernels |

The hardware figures come from NVIDIA's
[V100 data sheet](https://images.nvidia.com/content/technologies/volta/pdf/volta-v100-datasheet-update-us-1165301-r5.pdf),
[H100 specifications](https://www.nvidia.com/en-us/data-center/h100/), and
[DGX B200 specifications](https://www.nvidia.com/en-au/data-center/dgx-b200/).
DGX B200 exposes 1,440 GB and 64 TB/s across eight GPUs, giving 180 GB and
8 TB/s per GPU.

#### Published B200 result

NVIDIA's reproducible
[TensorRT-LLM performance overview](https://nvidia.github.io/TensorRT-LLM/latest/developer-guide/perf-overview.html#qwen3-30b-a3b)
reports the following Qwen3-30B-A3B FP4 offline maximum-throughput results on
one B200 (`TP1`). These are aggregate serving throughput with all requests
queued, not interactive single-user decode speed, so they are intentionally
kept separate from OPENZEKA's per-request numbers above.

| Input / output length | B200 FP4 output throughput per GPU |
|---:|---:|
| 1,000 / 1,000 | **26,971 tokens/s** |
| 1,024 / 1,024 | **26,611 tokens/s** |
| 1,024 / 8,192 | **13,497 tokens/s** |
| 1,024 / 32,768 | **4,494 tokens/s** |
| 8,192 / 1,024 | **5,735 tokens/s** |
| 32,768 / 1,024 | **1,265 tokens/s** |

NVIDIA does not publish V100 and H100 measurements for this model in that
same test table. Additional community and open-runtime results do provide
useful planning numbers, but their workloads differ from the B200 test:

| GPU | Published model / format | Workload | Published result |
|---|---|---|---:|
| V100 32 GB | Qwen3-30B-A3B NVFP4 through `vllm-rs`, software FP4 | Decode benchmark; batch/prompt details not disclosed on summary page | **67.10 tokens/s** |
| H100 80 GB, 1 GPU | Qwen3-Coder-30B-A3B-Instruct, vLLM 0.10.1.1, auto dtype | 10,000 random requests, 128 input + 128 output, max concurrency 1,000 | **17,349 aggregate output tokens/s** |
| H100 80 GB, 2 GPUs, TP2 | Same as preceding row | Same workload | **26,266 aggregate output tokens/s** |
| H100 80 GB, 4 GPUs, TP4 | Same as preceding row | Same workload | **25,804 aggregate output tokens/s** |
| H100 80 GB, 8 GPUs, TP8 | Same as preceding row | Same workload | **29,226 aggregate output tokens/s** |
| B200 180 GB, 1 GPU | Qwen3-30B-A3B FP4, TensorRT-LLM | Offline maximum throughput, 1,024 input + 1,024 output | **26,611 aggregate output tokens/s** |

The V100 figure comes from the open
[`vllm-rs` performance table](https://pypi.org/project/vllm-rs/0.11.5/).
It explicitly labels execution as **software FP4**, so it demonstrates that
the checkpoint can run—not that V100 has native NVFP4 acceleration. The H100
figures come from a published
[vLLM TP/DP benchmark](https://pavlokhmel.com/llm_inferencing_benchmark_with_vllm_benchmark_script_tensor_parallel_vs_data_parallel.html)
on a Dell PowerEdge XE9680. Its one-H100 result also reported 3,815 ms mean
TTFT and 83 ms mean inter-token latency. The weak TP scaling is important:
eight-way tensor parallelism delivered only 1.68x the aggregate throughput
of one H100 for this test, while consuming eight GPUs.

These values are **not a cross-GPU speed ranking**: the V100 number is decode
speed, the H100 numbers use 128/128 requests at high concurrency, and the
B200 number is an offline 1,024/1,024 maximum-throughput test. A valid
comparison must run the same checkpoint family, runtime, request count,
input/output lengths, and latency constraints:

```text
V100: FP16 or supported INT4 baseline
H100: BF16 baseline and FP8 optimized model
B200: BF16 baseline and NVFP4 optimized model
```

For capacity planning, one 32 GB V100 cannot hold the roughly 61 GB BF16
weights; one 80 GB H100 can hold them but leaves limited space for KV cache;
one 180 GB B200 has substantially more room for KV cache and batching. The
NVFP4 checkpoint reduces model storage/memory by approximately 3.3x, but
only B200 can combine that footprint reduction with native NVFP4 Tensor Core
execution.

## 3. Quality gap

**Direct answer:** the measured gap is **1.33 points on OpenLLM v1**
(73.25 BF16 versus 71.92 NVFP4, **98.19% quality retained**) and **2.49
points on HumanEval_64** (93.62 versus 91.13, **97.34% retained**). This is
a minimal average gap for general knowledge and coding. The harder OpenLLM
v2 suite loses 3.79 points (92.81% retained), so the claim does not apply
uniformly to every reasoning task.

The most directly relevant public comparison is Red Hat's open
[Qwen3-30B-A3B-NVFP4 model card](https://huggingface.co/RedHatAI/Qwen3-30B-A3B-NVFP4).
Its evaluation commands are published and compare the unquantized model with
the NVFP4 checkpoint.

| Evaluation | BF16/reference | NVFP4 | Absolute gap | Score recovery |
|---|---:|---:|---:|---:|
| OpenLLM v1 average | 73.25 | 71.92 | **-1.33** | **98.19%** |
| OpenLLM v2 average | 52.78 | 48.99 | **-3.79** | **92.81%** |
| HumanEval_64 pass@2 | 93.62 | 91.13 | **-2.49** | **97.34%** |

OpenLLM v1 individual recovery ranges from 96.19% to 101.20%. OpenLLM v2
is less uniform: IFEval retains 98.10% and MuSR 98.99%, while BBH retains
83.01% and MMLU-Pro 89.81%. This makes “minimal quality gap” a defensible
summary for the broad v1 average and coding result, but not for every hard
reasoning task.

NVIDIA's separately produced
[Qwen3-30B-A3B NVFP4 checkpoint](https://huggingface.co/nvidia/Qwen3-30B-A3B-NVFP4)
shows a similarly small or neutral gap on several tasks: BF16 to FP4 is
0.78 to 0.77 on MMLU-Pro, 0.62 to 0.61 on GPQA Diamond, and unchanged at
0.96 on MATH-500. Some generated-answer benchmarks score higher after
quantization (for example LiveCodeBench 0.51 to 0.65), which should be
treated as evaluation variance or a calibration effect—not evidence that
four-bit precision inherently improves the model.

### Acceptance criteria for our model

Ship NVFP4 only if all of the following hold against the merged BF16 model
under identical prompts and decoding settings:

- domain-task score loss is at most 2% relative;
- instruction-following and safety pass rates fall by no more than 1 point;
- no critical domain slice regresses by more than 3 points;
- human pairwise preference is statistically non-inferior; and
- measured serving throughput is at least 2x higher on the target Blackwell
  deployment at the expected context-length and concurrency distribution.

## 4. Conclusion

**We obtain a large performance speedup with a minimal quality gap.** The
best supported summary is **2.18–2.74x faster generation while retaining
98.19% of broad OpenLLM v1 quality and 97.34% of HumanEval coding quality**.

The recommended production path is **QLoRA fine-tuning followed by BF16
adapter merge and NVFP4 post-training quantization**. It avoids the memory
cost of full fine-tuning and converts the final model into the format that
Blackwell hardware accelerates.

The available open evidence supports the target claim: a closely matched
30B-A3B deployment achieved **2.18–2.74x higher generation speed**, while
the exact Qwen3-30B-A3B NVFP4 evaluation retained **98.19% of OpenLLM v1
quality and 97.34% of HumanEval quality**. In practical terms, that is a
large performance speedup with a minimal quality gap for general and coding
workloads. The qualification matters: difficult reasoning benchmarks show
larger regressions, so the final decision must be based on our own domain
evaluation rather than the aggregate headline alone.

Across the requested GPUs, **B200 is the only target for the full NVFP4
speedup claim** and reaches up to 26,971 aggregate output tokens/s per GPU in
NVIDIA's offline benchmark. H100 remains an excellent one-GPU deployment but
should use FP8; a separate high-concurrency vLLM test measured 17,349
aggregate output tokens/s on one H100. V100 requires aggressive memory
management and receives no native NVFP4 acceleration, although `vllm-rs`
reports 67.10 tokens/s using software FP4. Quality acceptance criteria remain
the same across hardware; performance must be measured separately for each
precision/runtime combination.

## Sources

1. Qwen Team, [Qwen3 Technical Report](https://arxiv.org/abs/2505.09388).
2. Qwen, [Qwen3-30B-A3B-Instruct-2507 model card](https://huggingface.co/Qwen/Qwen3-30B-A3B-Instruct-2507).
3. Dettmers et al., [QLoRA: Efficient Finetuning of Quantized LLMs](https://arxiv.org/abs/2305.14314).
4. Hugging Face PEFT, [LoRA/QLoRA developer guide](https://github.com/huggingface/peft/blob/main/docs/source/developer_guides/lora.md).
5. NVIDIA, [Qwen3-30B-A3B-NVFP4 model card](https://huggingface.co/nvidia/Qwen3-30B-A3B-NVFP4).
6. Red Hat AI, [Qwen3-30B-A3B-NVFP4 model card and evaluation](https://huggingface.co/RedHatAI/Qwen3-30B-A3B-NVFP4).
7. OPENZEKA, [Qwen3-Coder-30B-A3B-Instruct-NVFP4 performance comparison](https://huggingface.co/OPENZEKA/Qwen3-Coder-30B-A3B-Instruct-NVFP4).
8. NVIDIA, [Introducing NVFP4 for Efficient and Accurate Low-Precision Inference](https://developer.nvidia.com/blog/introducing-nvfp4-for-efficient-and-accurate-low-precision-inference/).
9. NVIDIA, [V100 Tensor Core GPU data sheet](https://images.nvidia.com/content/technologies/volta/pdf/volta-v100-datasheet-update-us-1165301-r5.pdf).
10. NVIDIA, [H100 Tensor Core GPU specifications](https://www.nvidia.com/en-us/data-center/h100/).
11. NVIDIA, [DGX B200 specifications](https://www.nvidia.com/en-au/data-center/dgx-b200/).
12. NVIDIA TensorRT-LLM, [Qwen3-30B-A3B performance overview](https://nvidia.github.io/TensorRT-LLM/latest/developer-guide/perf-overview.html#qwen3-30b-a3b).
13. `vllm-rs`, [published V100 software-FP4 performance table](https://pypi.org/project/vllm-rs/0.11.5/).
14. Pavlo Khmel, [Qwen3-Coder-30B-A3B vLLM tensor/data-parallel benchmark on H100](https://pavlokhmel.com/llm_inferencing_benchmark_with_vllm_benchmark_script_tensor_parallel_vs_data_parallel.html).
