# Qwen3-30B-A3B — LLM Forge Research Note

*16 Jul 2026. Internal note, not a Qwen/Alibaba publication. All benchmark
figures are published scores from Qwen's own model cards (see Sources) — no
new evaluation was run for this report. Rendered version with charts and
diagrams: see the published Artifact linked from this session.*

A 30.5B-parameter mixture-of-experts model that activates only 3.3B per
token — and, after its 2507 post-training refresh, closes most of the gap to
frontier dense models on reasoning and agentic benchmarks. This covers the
architecture, the training pipeline, and what adding it to the LLM Forge
catalog would take.

| | |
|---|---|
| Total / active params | 30.5B / 3.3B |
| Experts / active per token | 128 / 8 |
| Native context (2507 releases) | 262,144 |
| License | Apache 2.0 (Qwen3 family) |

## 1. Architecture

48 transformer layers, grouped-query attention (32 query heads, 4 key-value
heads), SwiGLU, rotary position embeddings, pre-norm RMSNorm. 29.9B of the
30.5B total parameters are non-embedding. Every forward pass activates only
**3.3B** of them.

Each MoE layer routes every token to 8 of 128 experts via a learned router,
trained with a **global-batch load-balancing loss** that encourages
specialization across the full batch rather than per-sequence. Notably, the
design has **no shared expert** — a departure from Qwen2.5-MoE's
architecture.

Compute cost tracks the 3.3B active figure, but every one of the 128 experts
must still be resident in memory, so **VRAM scales with the full 30.5B, not
the active 3.3B** — the efficiency gain is speed, not footprint (see §5).

**Where it sits in the Qwen3 family:**

| Model | Total params | Active params | Native context | In LLM Forge catalog? |
|---|---|---|---|---|
| Qwen2.5-7B Instruct | 7B | — (dense) | 131,072 | Yes |
| **Qwen3-30B-A3B** | **30.5B** | **3.3B** | **262,144¹** | **No — proposed, §5** |
| Qwen3-235B-A22B | 235B | 22B | 262,144 | Yes |

¹ 32,768 native on the original release, extendable to 131,072 via YaRN; the
2507 releases (§3) extend native context to 262,144, with Thinking-2507's
docs additionally citing support for up to 1M tokens under specialized
configuration.

The gap this fills: today's catalog jumps straight from a 7B dense model to
a 235B/22B-active frontier MoE. Qwen3-30B-A3B sits in the middle — MoE
efficiency at a size a single high-end GPU can serve.

## 2. Pretraining

The whole Qwen3 family was pretrained on **36 trillion tokens** across 119
languages and dialects — roughly double Qwen2.5's ~18T across 29 languages —
in three stages:

| Stage | Tokens | Sequence length | Focus |
|---|---|---|---|
| S1 — General | >30T | 4,096 | Broad language proficiency and world knowledge, all 119 languages |
| S2 — Reasoning | ~5T | 4,096 | Higher-quality data weighted toward STEM, code, reasoning, synthetic examples; faster LR decay |
| S3 — Long-context | 100s of billions | 32,768 | 75% long text (16K–32K tokens) / 25% medium (4K–16K) to extend usable context |

## 3. Post-training — the online fine-tuned version

Qwen's flagship dense models get a four-stage post-training pipeline: long
chain-of-thought cold start, reasoning-focused RL, thinking-mode fusion,
then general-domain RL. For a model this size, Qwen instead used
**strong-to-weak distillation** from a larger already-post-trained teacher —
roughly **1/10 the GPU-hours** of the full four-stage route. This is the
practical, cost-aware alignment path smaller models actually ship with.

The distilled checkpoints are what's actually hosted online as "the
fine-tuned version" of this base model — two variants, released July 2025:

- **[Qwen3-30B-A3B-Instruct-2507](https://huggingface.co/Qwen/Qwen3-30B-A3B-Instruct-2507)**
  — non-thinking only (no `<think>` blocks); tuned for instruction-following,
  general chat, coding, tool use.
- **[Qwen3-30B-A3B-Thinking-2507](https://huggingface.co/Qwen/Qwen3-30B-A3B-Thinking-2507)**
  — extended reasoning mode, longer chain-of-thought budget; scores highest
  of the three variants on nearly every reasoning benchmark (§4).

The original Qwen3-30B-A3B could switch between thinking and non-thinking
mode in a single checkpoint (`enable_thinking`, or `/think` / `/no_think`
soft switches); the 2507 refresh split that into two specialized checkpoints
instead, each pushed further in its lane.

## 4. Benchmark results

**What post-training bought — base vs. Instruct-2507:**

| Benchmark | Base | Instruct-2507 | Δ |
|---|---:|---:|---:|
| MMLU-Pro | 69.1 | 78.4 | +9.3 |
| GPQA | 54.8 | 70.4 | +15.6 |
| AIME25 | 21.6 | 61.3 | +39.7 |
| LiveCodeBench v6 | 29.0 | 43.2 | +14.2 |
| IFEval | 83.7 | 84.7 | +1.0 |
| Arena-Hard v2 | 24.8 | 69.0 | +44.2 |

**Full comparison across categories** (Base / Instruct-2507 / Thinking-2507 /
best-in-class from Qwen's published comparison set — GPT-4o, Gemini 2.5,
DeepSeek-V3, Qwen3-235B; not exhaustive):

| Category | Benchmark | Base | Instruct-2507 | Thinking-2507 | Best-in-class |
|---|---|---:|---:|---:|---|
| Knowledge | MMLU-Pro | 69.1 | 78.4 | 80.9 | 81.2 (DeepSeek-V3) |
| Knowledge | MMLU-Redux | 84.1 | 89.3 | 91.4 | 91.3 (GPT-4o) |
| Knowledge | GPQA | 54.8 | 70.4 | 73.4 | 78.3 (Gemini-2.5) |
| Knowledge | SuperGPQA | 42.2 | 53.4 | 56.8 | 57.3 (DeepSeek-V3) |
| Reasoning | AIME25 | 21.6 | 61.3 | 85.0 | 85.0 (Thinking-2507) |
| Reasoning | HMMT25 | 12.0 | 43.0 | 71.4 | 71.4 (Thinking-2507) |
| Reasoning | ZebraLogic | 33.2 | 90.0 | — | 90.0 (Instruct-2507) |
| Reasoning | LiveBench 20241125 | 59.4 | 69.0 | 76.8 | 76.8 (Thinking-2507) |
| Coding | LiveCodeBench v6 | 29.0 | 43.2 | 66.0 | 66.0 (Thinking-2507) |
| Coding | MultiPL-E | 74.6 | 83.8 | — | 83.8 (Instruct-2507) |
| Coding | Aider-Polyglot | 24.4 | 35.6 | — | 59.6 (Qwen3-235B) |
| Alignment | IFEval | 83.7 | 84.7 | 88.9 | 88.9 (Thinking-2507) |
| Alignment | Arena-Hard v2 | 24.8 | 69.0 | 56.0 | 69.0 (Instruct-2507) |
| Alignment | Creative Writing v3 | 68.1 | 86.0 | 84.4 | 86.0 (Instruct-2507) |
| Agent | BFCL-v3 | 58.6 | 65.1 | 72.4 | 72.4 (Thinking-2507) |
| Agent | TAU1-Retail | 38.3 | 59.1 | 67.8 | 67.8 (Thinking-2507) |
| Agent | TAU2-Airline | 18.0 | 38.0 | 58.0 | 58.0 (Thinking-2507) |
| Multilingual | MMLU-ProX | 65.1 | 72.0 | 76.4 | 78.3 (Gemini-2.5) |
| Multilingual | PolyMATH | 23.3 | 43.1 | 52.6 | 52.6 (Thinking-2507) |

**Reading this honestly**: post-training roughly triples the AIME25 score
(21.6 → 61.3) and nearly triples Arena-Hard v2 (24.8 → 69.0) without
touching the base weights' capacity — it's redirecting what the model
already knows, not adding knowledge. On several reasoning and agentic
benchmarks, Instruct-2507 and especially Thinking-2507 land within a few
points of Gemini 2.5 and DeepSeek-V3 despite activating roughly an order of
magnitude fewer parameters per token. That's the actual news here, more than
any single score.

## 5. Deployment on LLM Forge

MoE VRAM math is unforgiving: the router can send a token to any of the 128
experts, so **all of them must be resident** — there's no memory discount
for the 3.3B/30.5B activation ratio, only a compute one.

**Weight footprint by precision:**

| Precision | Bytes/param | Weights-only footprint |
|---|---:|---:|
| BF16 / FP16 | 2 | ~61 GB |
| INT8 | 1 | ~31 GB |
| INT4 (Q4-class) | 0.5 | ~15 GB |

Weights only — add KV cache (grows with context length and batch size) and
activation memory on top; third-party estimates put full-context BF16
inference around 65–98 GB depending on sequence length.

**Fine-tuning methods, estimated.** Full fine-tuning holds optimizer state
*per parameter*, not per active parameter — mixed-precision AdamW is roughly
16–18 bytes/param (bf16 weights + fp32 master weights + fp32 gradients + two
fp32 Adam moments). LoRA/QLoRA freeze the base weights, so cost is dominated
by the frozen-weight precision plus a small adapter:

| Method | Est. VRAM | Fits on |
|---|---:|---|
| QLoRA | ~24 GB | 1× RTX 4090, or 1× A100-40GB |
| LoRA | ~68 GB | 1× A100-80GB (tight) or 2× smaller GPUs |
| Full fine-tune | ~550 GB | Multi-GPU (see below) |

**Tie-back to this platform's own cluster**: LLM Forge's simulated GPU
cluster (`/gpu-cluster`) models 4×H100-80GB + 8×A100-80GB + 8×A100-40GB. A
full fine-tune of this model at ~550 GB wouldn't fit on the H100 nodes alone
(320 GB) — it would need to pool H100 and A100-80 capacity, or fall back to
LoRA/QLoRA, which is what most real deployments of a model this size
actually do.

These are estimates from standard bytes-per-parameter rules of thumb, not
measured on real hardware — flagged for verification against the training
scripts in `ml-tools/train/` the day this actually runs on a GPU (§6).

**Proposed `model-catalog.service.ts` entry:**

```ts
{
  id: 'qwen3-30b-a3b',
  name: 'Qwen3-30B-A3B',
  params: '30.5B total', paramsB: 3.3, contextWindow: 262144,
  license: 'Apache 2.0', licenseType: 'apache-2.0',
  useCase: 'Mid-size MoE — frontier-adjacent reasoning/agentic quality at a size a single high-end GPU can serve',
  huggingfaceId: 'Qwen/Qwen3-30B-A3B-Instruct-2507',
  architecture: 'Qwen-MoE', tags: ['multilingual', 'reasoning', 'moe', 'agentic'],
  vramRequiredGb: { qlora: 24, lora: 68, full: 550 },
  supportedMethods: ['qlora', 'lora', 'dpo'],
  isMoE: true, activeParams: '3.3B active',
}
```

`paramsB` follows this catalog's existing convention of storing the *active*
parameter count for MoE entries (see Qwen3-235B-A22B's `paramsB: 22`) — it's
what actually drives inference throughput, even though VRAM planning above
uses the total.

## 6. Fit with this platform's training scripts

The real training scripts in `ml-tools/train/` — built on
`trl.SFTTrainer`/`DPOTrainer` and `peft` — aren't architecture-specific; they
load any causal LM through `AutoModelForCausalLM`, so Qwen3-30B-A3B would
work with **zero script changes**. Adding it to the platform is a
catalog-entry change (§5), not a training-code change.

What's genuinely unverified is running it: those scripts were smoke-tested
on `Qwen/Qwen3-0.6B` — two orders of magnitude smaller — on CPU,
specifically to confirm correctness without provisioning paid GPU time (per
current project scope; see `ml-tools/train/README.md` for the full verified
list — LoRA, prefix-tuning, full fine-tune, and DPO all ran end-to-end on
real data). A first real benchmark on this model specifically would need an
actual rented GPU meeting the QLoRA footprint above (§5) at minimum, and
would be the natural next step once that's greenlit.

## Sources

1. Qwen Team. *Qwen3 Technical Report.* [arXiv:2505.09388](https://arxiv.org/html/2505.09388v1) — pretraining pipeline, token counts, post-training stages, MoE design.
2. [huggingface.co/Qwen/Qwen3-30B-A3B](https://huggingface.co/Qwen/Qwen3-30B-A3B) — base model card: architecture parameters, context length, thinking-mode toggle.
3. [huggingface.co/Qwen/Qwen3-30B-A3B-Instruct-2507](https://huggingface.co/Qwen/Qwen3-30B-A3B-Instruct-2507) — Instruct-2507 model card and benchmark table.
4. [huggingface.co/Qwen/Qwen3-30B-A3B-Thinking-2507](https://huggingface.co/Qwen/Qwen3-30B-A3B-Thinking-2507) — Thinking-2507 model card and benchmark table.
5. [apxml.com/models/qwen3-30b-a3b](https://apxml.com/models/qwen3-30b-a3b) — third-party VRAM/deployment estimates, cross-checked against this note's own bytes-per-parameter calculation.
6. Repo: `src/model-catalog/model-catalog.service.ts` (existing Qwen2.5-7B and Qwen3-235B-A22B entries) and `ml-tools/train/` (training scripts referenced in §6).
