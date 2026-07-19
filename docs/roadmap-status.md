# LLM Forge evidence roadmap

Status date: **17 July 2026**

“Implemented” means code and local verification exist. “Operationally
verified” requires evidence from the deployed service or target GPU. These
states are kept separate throughout this roadmap.

| Component                        | Status as of 17 Jul 2026                                                      | Evidence in repository                                                                                                                            | Next evidence-producing step                                                                                                                            |                Estimated effort |
| -------------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------: |
| Credential and secret management | **Implemented; deployment screenshots pending**                               | Environment-only admin bootstrap and rotation in `src/users/users.service.ts`; fail-fast JWT secret; `.env.example`; `docs/deployment-secrets.md` | Capture provider configuration and password-rotation screenshots with all values and identifiers redacted                                               |                         2–3 hrs |
| Dataset processing               | **Implemented for JSONL/CSV/Parquet; deployed scale test pending**            | `src/datasets/dataset-parsers.ts`; real record counts/schema validation; sample datasets                                                          | Upload a larger fixture through the deployed API and capture throughput, process memory, validation failures, and stored metadata                       |                        6–10 hrs |
| Standalone training scripts      | **v0.1 rented-A100 CUDA QLoRA result completed; evidence package partial**     | `ml-tools/train/`; submitted Vast.ai A100 v0.1 run report with benchmark scores and loss samples                                                  | Add immutable model/dataset revisions, resolved paths/config, raw logs, GPU-hours/cost, memory trace, evaluation commands, and adapter checksum          |                         2–4 hrs |
| In-platform training execution   | **Partial: secure local worker implemented; CUDA backend run pending**        | Explicit mock/local modes; catalog allowlist; shell-free launch; confined paths; log/metric streaming; cancellation/failure state; tests          | Deploy on the CUDA worker, run through API/UI, verify restart recovery, and attach persistent artifacts                                                 |                       20–35 hrs |
| GPU telemetry                    | **Implemented collector; live job correlation pending**                       | Real `nvidia-smi` collector, fail-closed mode, labeled mock fallback, and unit tests in `src/gpu-metrics/` (commit `a4c2cbc`)                     | Run on the same CUDA worker as training, capture a time series, attach job ID, and optionally add DCGM                                                  |    8–16 hrs after worker access |
| FP8 conversion                   | **Partial: standalone elementwise converter verified**                        | `ml-tools/quantize/bf16_to_fp8.py` and verification notes                                                                                         | Add calibrated/scaled conversion or retain an explicit experimental label; persist metadata and before/after accuracy                                   |                       20–30 hrs |
| GGUF export and quantization     | **Partial: standalone GGUF verified; local adapter registration implemented** | `ml-tools/gguf/`; completed worker adapters receive exact size/SHA-256 and authenticated local downloads                                          | Launch GGUF from backend; store outputs in persistent object storage and return expiring signed downloads                                               |                       15–25 hrs |
| GPTQ export                      | **Pending**                                                                   | UI/API format exists but artifact service simulates completion                                                                                    | Implement CUDA calibration, persist the artifact, and compare size, GPU memory, latency, and quality with GGUF/FP8                                      |         25–40 hrs plus GPU cost |
| End-to-end benchmark report      | **Standalone run report submitted; in-platform report pending**               | `docs/reports/qwen3-30b-a3b-v0.1-a100-qlora-run-report.md` contains the submitted A100 benchmark scores and loss samples                          | Attach the standalone run's raw evidence, then complete upload → train → monitor → export → reload/infer through the platform                            | 12–18 hrs after platform runner |
| Release packaging                | **Partial: changelog exists; release evidence incomplete**                    | `CHANGELOG.md`; source history                                                                                                                    | Confirm demo fallback, freeze known limitations, tag the verified commit, publish GitHub Release notes and checksums                                    |                        6–10 hrs |
| AMD ROCm support                 | **Pending**                                                                   | No ROCm worker or verified dependency path                                                                                                        | Port one training configuration and run the same model/dataset/evaluation on AMD and NVIDIA                                                             |    45–70 hrs plus hardware cost |
| External evaluation and adoption | **Exploratory only**                                                          | No signed pilot/evaluation document in repository                                                                                                 | Define workload, schedule, success criteria, confidentiality, disclosure permissions, and obtain signed evidence                                        |             External dependency |

## Current truthful product boundary

- The public demo defaults to simulated training. An opt-in local backend
  worker is implemented but has not yet completed a documented CUDA run
  through the API/UI.
- The LLM Forge v0.1 result is a completed standalone CUDA QLoRA run on a
  rented Vast.ai A100, with submitted tuned benchmark scores and loss samples.
  Its raw logs, immutable revisions,
  memory/cost evidence, evaluation commands, and adapter checksum remain to
  be attached; the in-platform end-to-end run remains pending.
- GPU telemetry can be real when the backend runs beside `nvidia-smi`, but no
  training-job-correlated capture has been produced yet.
- Public baseline benchmark values in the submitted report are external Qwen
  references; the tuned values are recorded as results from the completed
  standalone LLM Forge run.

## Evidence completion rule

A component moves to “completed” only when its code, reproducibility command,
raw or machine-readable output, environment revision, verification result,
and immutable commit are available. Paid-infrastructure items also require
the provider instance type, elapsed GPU-hours, rate, and redacted billing
evidence.
