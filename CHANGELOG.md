# Changelog

## Unreleased

### Deployment security documentation

- Documented every backend/frontend environment variable, initial secret
  setup, administrator password rotation, JWT and database credential
  rotation, verification steps, audit commands, and requirements for
  redacted deployment screenshots. No deployment screenshot is claimed until
  dashboard access is available.
- Added a dated evidence roadmap that separates implemented code from
  operational verification and links each component to its next measurable
  completion step.

### Real GPU telemetry path

- Added an `nvidia-smi` backend collector for utilization, HBM usage,
  temperature, power draw/limit, and SM clock on every visible NVIDIA GPU.
  API responses now identify their `source` (`nvidia-smi` or `mock`) and
  collection time instead of presenting randomized demo nodes as real data.
- Added `GPU_METRICS_MODE=auto|real|mock`: `real` fails closed when telemetry
  is unavailable, `auto` falls back with an explicit warning, and `mock`
  preserves deterministic demo behavior for hosts without GPUs.
- Added unit coverage for real summaries, mock fallback, invalid config, and
  fail-closed operation. Corrected the stale API-root unit test discovered by
  the full test run.
- This does not provision GPUs or make web-launched training real. The public
  flow remains simulated, the standalone Hugging Face scripts are not fully
  connected to `JobsService`, and no CUDA QLoRA run on rented GPU
  infrastructure has been completed.

### Benchmark preparation

- Added a Qwen3-30B-A3B CUDA QLoRA run-report template with official Qwen
  reference scores prefilled and separate blank columns for the locally
  reproduced base and LLM Forge-tuned adapter. The template captures exact
  commands, environment revisions, GPU telemetry, duration, cost, loss curve,
  adapter checksum, raw evidence, acceptance gates, and results commit.

## v0.1.0 — 2026-07-16

First tagged release. LLM Forge is a fine-tuning platform demo — most of the
product surface (training progress, GPU cluster, artifact quantization) is
still simulated by design, so this changelog tracks which parts are real
versus simulated as clearly as it tracks feature additions.

### Security

- **Fixed**: hardcoded admin backdoor credentials (`cwx0319@gmail.com` /
  `demo1234`) and a hardcoded JWT signing-secret fallback were removed from
  source. Admin account creation is now entirely `ADMIN_EMAIL`/
  `ADMIN_PASSWORD` env-driven (no account is created if unset, and rotating
  the password in production is just changing the env var and redeploying).
  `JWT_SECRET` has no fallback — the app now fails fast at startup if it's
  missing.

### Real (not simulated)

- **Dataset processing**: uploads are now actually parsed and validated —
  JSONL is streamed and JSON-validated with chat/alpaca/DPO schema
  detection, CSV goes through a real RFC 4180 streaming parser, Parquet
  reads real footer metadata for row count and schema. Bad uploads land in
  `status=error` with a real error message instead of a fabricated record
  count. (Previously: `recordCount = fileSize / 256`.)
- **BF16→FP8 quantization** (`ml-tools/quantize/`): real elementwise cast to
  PyTorch's native `float8_e4m3fn`, verified against a real
  `Qwen/Qwen3-0.6B` checkpoint pulled from HuggingFace — exact 2x size
  reduction, 4x confirmed on a synthetic FP32 tensor.
- **GGUF export + quantization** (`ml-tools/gguf/`): real llama.cpp
  pipeline (`convert_hf_to_gguf.py` + compiled `llama-quantize`), verified
  end-to-end on `Qwen/Qwen3-0.6B` — 1.4 GB F16 → 461.8 MB Q4_K_M (3.12x) —
  and the quantized model was actually run for inference, producing
  coherent, correct completions.
- **Training scripts** (`ml-tools/train/`): native HuggingFace training —
  `trl.SFTTrainer`/`trl.DPOTrainer` plus `peft` for LoRA/QLoRA/prefix-tuning
  — covering full fine-tune, LoRA, QLoRA, prefix-tuning, and DPO. CLI flags
  mirror the finetune wizard's config 1:1. All four SFT methods and DPO were
  run end-to-end on real data against `Qwen/Qwen3-0.6B` (full fine-tune
  verified on a tiny model instead — CPU optimizer-state memory makes full
  fine-tuning 0.6B impractically slow locally). Not wired into the backend
  and not run on rented GPUs — that's a separate infra/spending decision.

### Still simulated

- **Training execution** in the product itself: `jobs.service.ts` still
  runs a `setTimeout` chain with fabricated loss curves — no GPU is
  provisioned, no real training happens through the website. The real
  scripts exist (see above) but aren't wired in.
- **GPU cluster monitoring**: the 20-node cluster grid is randomized mock
  data, not real `nvidia-smi`/DCGM telemetry — depends on the same rented
  GPU infra as real training execution.
- **Artifact export**: GPTQ quantization isn't implemented (calibration is
  CUDA-only in practice, nothing to honestly verify on this dev machine).
  Downloads still return a placeholder URL — no real object storage is
  wired up.

### Fixed

- Frontend production build (`next build`) was failing its type-check step
  on the Distill & Compress review page (`.filter(Boolean)` doesn't narrow
  `null` for TypeScript) — this had been broken since that page was added,
  blocking any real deploy of that code.
- Backend build (`nest build`) broke after adding `ml-tools/` — its vendored
  llama.cpp CMake build directory contains `*.ts` timestamp files that got
  swept into TypeScript compilation. Excluded `ml-tools/` from
  `tsconfig.build.json`.
- Pre-existing type bug in the HuggingFace dataset-import path
  (`Object.values(...)[0]?.splits`); also stopped fabricating a random
  record count when HF's datasets-server has no real stats for a dataset.

### Not started

- First real fine-tuning benchmark + report (GPU-hours/cost/memory vs. the
  estimator) — needs an actual rented GPU.
- Cross-vendor AMD ROCm support — new territory, scope TBD.
