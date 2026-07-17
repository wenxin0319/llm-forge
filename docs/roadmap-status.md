# LLM Forge evidence roadmap

Status date: **17 July 2026**

“Implemented” means code and local verification exist. “Operationally
verified” requires evidence from the deployed service or target GPU. These
states are kept separate throughout this roadmap.

| Component | Status as of 17 Jul 2026 | Evidence in repository | Next evidence-producing step | Estimated effort |
|---|---|---|---|---:|
| Credential and secret management | **Implemented; deployment screenshots pending** | Environment-only admin bootstrap and rotation in `src/users/users.service.ts`; fail-fast JWT secret; `.env.example`; `docs/deployment-secrets.md` | Capture provider configuration and password-rotation screenshots with all values and identifiers redacted | 2–3 hrs |
| Dataset processing | **Implemented for JSONL/CSV/Parquet; deployed scale test pending** | `src/datasets/dataset-parsers.ts`; real record counts/schema validation; sample datasets | Upload a larger fixture through the deployed API and capture throughput, process memory, validation failures, and stored metadata | 6–10 hrs |
| Standalone training scripts | **Partial: real scripts and CPU smoke tests completed** | `ml-tools/train/`; TRL/PEFT/bitsandbytes paths; CPU smoke-test notes | Execute QLoRA on CUDA and preserve immutable model/dataset revisions, commands, logs, GPU-hours/cost, memory, adapter checksum, and the completed report template | 10–16 hrs plus GPU cost |
| In-platform training execution | **Pending: public web job runner remains simulated** | Simulation is still in `src/jobs/jobs.service.ts`; standalone scripts are not connected | Add a constrained backend worker that launches approved scripts, streams metrics, handles cancellation/failure, and recovers persisted state | 45–65 hrs |
| GPU telemetry | **Implemented collector; live job correlation pending** | Real `nvidia-smi` collector, fail-closed mode, labeled mock fallback, and unit tests in `src/gpu-metrics/` (commit `a4c2cbc`) | Run on the same CUDA worker as training, capture a time series, attach job ID, and optionally add DCGM | 8–16 hrs after worker access |
| FP8 conversion | **Partial: standalone elementwise converter verified** | `ml-tools/quantize/bf16_to_fp8.py` and verification notes | Add calibrated/scaled conversion or retain an explicit experimental label; persist metadata and before/after accuracy | 20–30 hrs |
| GGUF export and quantization | **Partial: standalone conversion and inference verified** | `ml-tools/gguf/` real llama.cpp pipeline | Launch from backend artifact flow; store outputs in persistent object storage with size and SHA-256; return signed downloads | 20–30 hrs |
| GPTQ export | **Pending** | UI/API format exists but artifact service simulates completion | Implement CUDA calibration, persist the artifact, and compare size, GPU memory, latency, and quality with GGUF/FP8 | 25–40 hrs plus GPU cost |
| End-to-end benchmark report | **Template complete; run pending** | `docs/reports/qwen3-30b-a3b-qlora-run-template.md` with published Qwen references and blank local/tuned results | Complete upload → train → monitor → export → reload/infer and compare measured cost/memory/time/size with estimates | 12–18 hrs after platform runner |
| Release packaging | **Partial: changelog exists; release evidence incomplete** | `CHANGELOG.md`; source history | Confirm demo fallback, freeze known limitations, tag the verified commit, publish GitHub Release notes and checksums | 6–10 hrs |
| AMD ROCm support | **Pending** | No ROCm worker or verified dependency path | Port one training configuration and run the same model/dataset/evaluation on AMD and NVIDIA | 45–70 hrs plus hardware cost |
| External evaluation and adoption | **Exploratory only** | No signed pilot/evaluation document in repository | Define workload, schedule, success criteria, confidentiality, disclosure permissions, and obtain signed evidence | External dependency |

## Current truthful product boundary

- The public web training flow is simulated.
- Standalone training and conversion scripts are not fully connected to the
  NestJS backend.
- No real rented-GPU CUDA QLoRA run has been completed by LLM Forge.
- GPU telemetry can be real when the backend runs beside `nvidia-smi`, but no
  training-job-correlated capture has been produced yet.
- Public baseline benchmark values in report templates are external Qwen
  references; blank LLM Forge columns remain blank until measured.

## Evidence completion rule

A component moves to “completed” only when its code, reproducibility command,
raw or machine-readable output, environment revision, verification result,
and immutable commit are available. Paid-infrastructure items also require
the provider instance type, elapsed GPU-hours, rate, and redacted billing
evidence.
