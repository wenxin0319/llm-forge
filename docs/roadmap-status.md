# LLM Forge evidence roadmap

Status date: **26 July 2026**

“Implemented” means code and local verification exist. “Operationally
verified” requires evidence from the deployed service or target GPU. These
states are kept separate throughout this roadmap.

| Component                        | Status as of 26 Jul 2026                                                      | Evidence in repository                                                                                                                            | Next evidence-producing step                                                                                                                            |                Estimated effort |
| -------------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------: |
| Credential and secret management | **Implemented; deployment screenshots pending**                               | Environment-only admin bootstrap and rotation in `src/users/users.service.ts`; fail-fast JWT secret; `.env.example`; `docs/deployment-secrets.md` | Capture provider configuration and password-rotation screenshots with all values and identifiers redacted                                               |                         2–3 hrs |
| Dataset processing               | **Implemented for JSONL/CSV/Parquet; deployed scale test pending**            | `src/datasets/dataset-parsers.ts`; real record counts/schema validation; fixed a CSV read-stream error that crashed the whole process on a missing/unreadable file; unit tests for all four parsers in `dataset-parsers.spec.ts`; sample datasets | Upload a larger fixture through the deployed API and capture throughput, process memory, validation failures, and stored metadata                       |                        4–8 hrs |
| Standalone training scripts      | **v0.2 rented-A100 CUDA QLoRA result completed; evidence package partial**     | `ml-tools/train/`; submitted Vast.ai A100 v0.2 real-test report with measured benchmark scores and loss samples                                   | Add immutable model/dataset revisions, resolved paths/config, raw logs, GPU-hours/cost, memory trace, evaluation commands, and adapter checksum          |                         2–4 hrs |
| In-platform training execution   | **CUDA backend run completed via the real API on a rented GPU**               | Registered a real user, uploaded a real dataset, and launched a real QLoRA job through `POST /training/launch` → `POST /jobs` against `Qwen/Qwen2.5-7B-Instruct` on a rented Vast.ai RTX 4090 (48GB). Completed in 46s (model cached) with real per-step loss (`0.18` → `0.11`), a real registered adapter artifact (`adapter_model.safetensors`, SHA-256-checksummed, 10,107,504 bytes), and real `avgTokensPerSec`/`totalTrainingSec`. This also verifies QLoRA's actual 4-bit `bitsandbytes` path, previously untested on real hardware (see `ml-tools/train/README.md`) | Verify restart recovery (kill/restart the backend mid-job); test `full_fine_tune` and `prefix_tuning` methods; persist artifacts beyond local disk      |                       10–20 hrs |
| GPU telemetry                    | **Verified end to end on a real CUDA host, job-ID correlation confirmed**     | The same rented-GPU run above: `GET /gpu-metrics/cluster` returned `source: "nvidia-smi"` with real temp/power/48GB VRAM; the job's metric time series carried real, varying `gpuUtilPct` (26–41%) and `gpuMemUsedGb` (9.94) values tagged to that job's PID throughout training — not mock data. Fixed a real bug found in the process: `finishRealJob` never rolled per-step `gpuMemUsedGb` into the job's `peakGpuMemGb` summary field (the simulated-training path did this, the real path didn't); extracted a shared `computePeakGpuMemGb` helper, unit-tested, and re-verified against a second real run (`peakGpuMemGb: 9.9`, matching the raw data) | Add DCGM for richer telemetry (temperature/power trends); verify under multi-GPU / multi-job concurrency, which this single-job single-GPU run didn't exercise |     4–8 hrs |
| FP8 conversion                   | **Partial: standalone elementwise converter verified**                        | `ml-tools/quantize/bf16_to_fp8.py` and verification notes                                                                                         | Add calibrated/scaled conversion or retain an explicit experimental label; persist metadata and before/after accuracy                                   |                       20–30 hrs |
| GGUF export and quantization     | **Partial: real LoRA/QLoRA and full-fine-tune GGUF export now run from the backend on job completion** | `src/artifacts/artifacts.service.ts` `createLocalGgufLoraAdapter` spawns the verified `convert_lora_to_gguf.py` tool (shell-free, path-confined) when a completed local LoRA/QLoRA job requested `outputFormat: 'gguf'`; verified end to end against a real CPU LoRA training run (correct rank-16 tensor shapes). `createLocalMergedGgufArtifact` covers the full-fine-tune case using the same shell-free, path-confined pattern and the already-verified two-step `convert_hf_to_gguf.py` + `llama-quantize` pipeline (`ml-tools/gguf/convert_to_gguf.py`, `ml-tools/gguf/README.md`); unit-tested with a mocked two-step subprocess (success, custom quant target, missing checkpoint, missing tooling, path confinement, stderr surfaced from either step) but **not yet run end to end against a real full-fine-tune checkpoint** the way the LoRA path was | Run the merged-GGUF path end to end against a real full-fine-tune checkpoint (e.g. the tiny random-weight Qwen2.5 used to verify `sft_train.py --method full_fine_tune`); cover GPTQ; move from local disk to persistent object storage with expiring signed downloads |                        8–16 hrs |
| GPTQ export                      | **Partial: real standalone CUDA calibration verified; backend wiring pending** | `ml-tools/quantize/gptq_quantize.py` runs real GPTQ via `gptqmodel` — real calibration forward passes + per-layer Hessian solve (not a size estimate) — verified against `Qwen/Qwen2.5-7B-Instruct` on a rented RTX 4090: BF16 ~15GB → INT4 5.2GB (~2.9x), then reloaded the quantized checkpoint and ran real greedy-decoded generation (coherent, factually correct, syntactically valid Python) to confirm the model itself survived quantization, not just the file size. `artifacts.service.ts`'s `scheduleQuantization` still simulates GPTQ completion — this tool isn't wired into the backend yet | Wire `gptq_quantize.py` into `ArtifactsService`/`JobsService` the way GGUF is wired; persist the artifact; compare GPU memory/latency/quality against GGUF/FP8 with a calibration corpus closer to production (this run used 64 synthetic samples for speed, not C4/wikitext2) |                       15–25 hrs |
| End-to-end benchmark report      | **v0.2 real standalone run reported; in-platform report pending**             | `docs/reports/qwen3-30b-a3b-v0.2-a100-qlora-run-report.md` contains measured A100 benchmark scores and loss samples                              | Attach the standalone run's raw evidence, then complete upload → train → monitor → export → reload/infer through the platform                            | 12–18 hrs after platform runner |
| Release packaging                | **Partial: changelog exists; release evidence incomplete**                    | `CHANGELOG.md`; source history                                                                                                                    | Confirm demo fallback, freeze known limitations, tag the verified commit, publish GitHub Release notes and checksums                                    |                        6–10 hrs |
| AMD ROCm support                 | **Pending**                                                                   | No ROCm worker or verified dependency path                                                                                                        | Port one training configuration and run the same model/dataset/evaluation on AMD and NVIDIA                                                             |    45–70 hrs plus hardware cost |
| External evaluation and adoption | **Exploratory only**                                                          | No signed pilot/evaluation document in repository                                                                                                 | Define workload, schedule, success criteria, confidentiality, disclosure permissions, and obtain signed evidence                                        |             External dependency |

## Current truthful product boundary

- The public demo defaults to simulated training. An opt-in local backend
  worker is implemented and has now completed a real, documented CUDA run
  through the actual API (`POST /training/launch`) on a rented Vast.ai
  RTX 4090 — not just the standalone training scripts. Restart recovery and
  the `full_fine_tune`/`prefix_tuning` methods remain unexercised through the
  API.
- The LLM Forge v0.2 result is a completed standalone CUDA QLoRA run on a
  rented Vast.ai A100, with submitted tuned benchmark scores and loss samples.
  Its raw logs, immutable revisions,
  memory/cost evidence, evaluation commands, and adapter checksum remain to
  be attached; the in-platform end-to-end run remains pending.
- GPU telemetry is confirmed real end to end: a rented-GPU run showed real
  `nvidia-smi`-sourced cluster data and real, job-correlated
  `gpuUtilPct`/`gpuMemUsedGb` values landing in that job's metric time series
  during actual training — not the mocked `nvidia-smi` this path was
  previously tested against.
- GPTQ export has a real, CUDA-verified standalone tool
  (`ml-tools/quantize/gptq_quantize.py`) producing a real INT4 checkpoint
  that runs coherent inference, but it is not wired into the backend —
  `scheduleQuantization` in `artifacts.service.ts` still simulates GPTQ
  completion.
- Public baseline benchmark values in the submitted report are external Qwen
  references; the tuned values are recorded as results from the completed
  standalone LLM Forge run.

## Evidence completion rule

A component moves to “completed” only when its code, reproducibility command,
raw or machine-readable output, environment revision, verification result,
and immutable commit are available. Paid-infrastructure items also require
the provider instance type, elapsed GPU-hours, rate, and redacted billing
evidence.
