# LLM Forge

> Open-source self-serve platform for fine-tuning customized, lightweight LLMs on your own data — with GPU acceleration, parallel training, one-click model delivery, and a clinical EMR annotation workspace.

![License](https://img.shields.io/badge/license-MIT-blue)
![Node](https://img.shields.io/badge/node-20%2B-brightgreen)
![NestJS](https://img.shields.io/badge/backend-NestJS-e0234e)
![Next.js](https://img.shields.io/badge/frontend-Next.js%2015-black)

---

## What it does

LLM Forge combines two things in one platform:

### LLM Fine-tuning
1. **Browse the model catalog** — 14 curated open-source models (Llama 4, Mistral, Phi-4, DeepSeek-R1, and more) with specs, VRAM requirements, and license info
2. **Upload your dataset** — JSONL, CSV, Parquet, or plain text; drag-and-drop with format auto-detection and column mapping
3. **Launch a fine-tuning job** — pick QLoRA / LoRA / Full / DPO, configure GPU tier and hyperparameters, watch live loss curves
4. **Download your model** — adapter weights, merged FP16, GGUF (Ollama-ready), or GPTQ INT4

### Clinical EMR Workspace
- **Case Explorer** — browse and filter patient cases by status, condition, and priority
- **Annotation Tool** — highlight clinical entities (diagnoses, medications, procedures, lab results) in medical documents with AI-assisted pre-annotations and confidence scores
- **Document Browser** — view admission notes, discharge summaries, and clinical reports side by side

> **No backend required for demos** — the frontend includes a full offline mock mode with demo accounts, simulated training progress, and sample EMR data.

---

## Project structure

```
llm-forge/
├── src/                          # NestJS backend (port 3001)
│   ├── auth/                     # JWT authentication
│   ├── users/                    # Accounts & GPU quota tracking
│   ├── model-catalog/            # 14 open-source model definitions + search/filter
│   ├── datasets/                 # Multipart upload, format detection, preprocessing
│   ├── models/                   # User model configurations
│   ├── training/                 # Fine-tune job launch & cost estimation
│   ├── jobs/                     # Job lifecycle, per-step metrics, log streaming
│   ├── artifacts/                # Model outputs (adapter, merged, GGUF, GPTQ) + quantization
│   └── gpu-metrics/              # 20-node cluster utilization simulation
└── nextjs-frontend/              # Next.js 15 App Router UI (port 3000)
    └── src/
        ├── lib/
        │   ├── auth.tsx          # JWT auth context + mock login for demo mode
        │   └── mockStore.ts      # LocalStorage-based job store (no backend needed)
        └── app/
            ├── page.tsx          # Dashboard — charts, recent jobs
            ├── catalog/          # Model browser — filters, detail drawer, compare modal
            ├── finetune/         # 3-step wizard: dataset → config → launch
            ├── jobs/             # All jobs list
            ├── jobs/[id]/        # Live training monitor — loss curves, logs, throughput
            ├── jobs/[id]/artifacts/ # Download center — GGUF/GPTQ, chat widget, API key
            ├── emr/              # EMR case list and document browser
            ├── emr/annotate/     # Clinical entity annotation tool
            ├── emr/cases/        # Case explorer with filters
            ├── datasets/         # Dataset management
            ├── models/           # Saved model configurations
            ├── gpu-cluster/      # Real-time GPU node grid
            └── settings/         # Account & API access
```

---

## Getting started

### Try it instantly (no backend needed)

```bash
git clone https://github.com/wenxin0319/llm-forge.git
cd llm-forge/nextjs-frontend
npm install
npm run dev
# Open http://localhost:3000
# Login with: demo@llmforge.ai / demo1234
```

The frontend runs fully in demo mode — training jobs simulate real progress, loss curves animate, and EMR data is pre-loaded.

### Run with the full backend

```bash
# Terminal 1 — Backend
cd llm-forge
cp .env.example .env
npm install
npm run start:dev
# API:   http://localhost:3001
# Docs:  http://localhost:3001/api/docs

# Terminal 2 — Frontend
cd llm-forge/nextjs-frontend
cp .env.example .env.local
npm install
npm run dev
# UI: http://localhost:3000
```

### Demo accounts

| Email | Password | Description |
|---|---|---|
| `demo@llmforge.ai` | `demo1234` | General demo account |
| `cwx0319@gmail.com` | `demo1234` | Admin demo account |

---

## Environment variables

**Backend `.env`**

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3001` | API server port |
| `JWT_SECRET` | `llmforge-dev-secret` | Change in production |
| `FRONTEND_URL` | `http://localhost:3000` | CORS allowed origin |

**Frontend `nextjs-frontend/.env.local`**

| Variable | Default | Description |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | `http://localhost:3001/api/v1` | Backend API base URL |

---

## Model catalog

14 curated open-source models across all major families:

| Model | Active Params | Context | License | Best for |
|---|---|---|---|---|
| Llama 3.1 8B Instruct | 8B | 128K | Meta Community | Chat, instruction, fine-tuning baseline |
| Llama 3.1 70B Instruct | 70B | 128K | Meta Community | High-quality reasoning, production |
| Llama 4 Scout | 17B (MoE) | 10M | Llama 4 | Ultra-long context RAG |
| Mistral 7B Instruct v0.3 | 7.3B | 32K | Apache 2.0 | Budget fine-tuning on single GPU |
| Mistral Small 4 | 6.5B (MoE) | 256K | Apache 2.0 | Function calling, chatbots |
| Phi-4 | 14B | 16K | MIT | Reasoning, code, low-VRAM |
| Phi-4-reasoning | 14B | 32K | MIT | Math, multi-step problem solving |
| Gemma 4 26B-A4B | 3.8B (MoE) | 256K | Apache 2.0 | Private docs, offline agents |
| Qwen2.5-7B Instruct | 7B | 128K | Apache 2.0 | Multilingual, Asian-language apps |
| Qwen3-235B-A22B | 22B (MoE) | 256K | Apache 2.0 | Frontier-quality multilingual |
| DeepSeek-R1 | 37B (MoE) | 128K | MIT | Chain-of-thought, math |
| DeepSeek-R1-Distill-Qwen-7B | 7B | 128K | MIT | Affordable local reasoning |
| Falcon 40B | 40B | 2K | Apache 2.0 | Research baseline |
| Yi-34B-Chat | 34B | 4K | Apache 2.0 | Bilingual Chinese/English |

---

## Fine-tuning methods

| Method | VRAM savings | Quality | Best for |
|---|---|---|---|
| **QLoRA** *(recommended)* | ~75% | 80–90% of full FT | Consumer or cloud GPUs, most use cases |
| **LoRA** | ~40% | 90–95% of full FT | Higher quality when VRAM allows |
| **Full fine-tune** | None | 100% | Maximum quality, large clusters |
| **DPO** | ~75% (with QLoRA) | +5–15 ELO vs SFT | Aligning model behavior with preferences |

---

## Output formats

| Format | Typical size | Run with |
|---|---|---|
| Adapter only | ~30 MB | Merge with base at inference time |
| Merged FP16 | 4–70 GB | Any FP16-compatible inference server |
| GGUF Q4\_K\_M | 1–20 GB | Ollama, LM Studio, llama.cpp |
| GPTQ INT4 | 1–20 GB | vLLM, text-generation-inference |

---

## GPU cluster

Simulates a 20-node heterogeneous cluster with live utilization metrics:

| Node type | Count | VRAM | TFLOPs | NVLink |
|---|---|---|---|---|
| H100 SXM5 80GB | 4 | 80 GB | 989 | 900 GB/s |
| A100 SXM4 80GB | 8 | 80 GB | 312 | 600 GB/s |
| A100 SXM4 40GB | 8 | 40 GB | 312 | — |

---

## API reference

Full interactive docs at `http://localhost:3001/api/docs` (Swagger UI).

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/api/v1/auth/register` | — | Create account |
| `POST` | `/api/v1/auth/login` | — | Login, receive JWT |
| `GET` | `/api/v1/auth/me` | ✓ | Current user profile |
| `GET` | `/api/v1/catalog` | — | Browse model catalog |
| `GET` | `/api/v1/catalog/:id` | — | Model details & VRAM requirements |
| `POST` | `/api/v1/datasets` | ✓ | Upload dataset (multipart, up to 5 GB) |
| `GET` | `/api/v1/datasets` | ✓ | List datasets |
| `DELETE` | `/api/v1/datasets/:id` | ✓ | Delete a dataset |
| `POST` | `/api/v1/training/launch` | ✓ | Launch a fine-tuning job |
| `GET` | `/api/v1/jobs` | ✓ | List all jobs |
| `GET` | `/api/v1/jobs/:id` | ✓ | Job status, logs, and config |
| `GET` | `/api/v1/jobs/:id/metrics` | ✓ | Per-step loss, LR, and throughput |
| `POST` | `/api/v1/jobs/:id/cancel` | ✓ | Cancel a running job |
| `GET` | `/api/v1/artifacts` | ✓ | List model artifacts |
| `GET` | `/api/v1/artifacts/:id` | ✓ | Artifact metadata + pre-signed download URL |
| `POST` | `/api/v1/artifacts/:id/quantize` | ✓ | Trigger async GGUF / GPTQ quantization |
| `DELETE` | `/api/v1/artifacts/:id` | ✓ | Delete an artifact |
| `GET` | `/api/v1/gpu-metrics/cluster` | ✓ | Full cluster utilization metrics |

---

## Deploy

### Vercel + Railway (recommended)

```bash
# Frontend → Vercel
cd nextjs-frontend
npx vercel --prod

# Backend → Railway
# 1. railway.app → New Project → deploy from GitHub (wenxin0319/llm-forge)
# 2. Railway auto-detects Dockerfile
# 3. Add env vars: JWT_SECRET, FRONTEND_URL=https://your-app.vercel.app
```

Set `NEXT_PUBLIC_API_URL=https://your-backend.railway.app/api/v1` on Vercel.

---

## Contributing

Pull requests are welcome. For major changes please open an issue first.

```bash
# Type-check backend
npx tsc --noEmit --project tsconfig.build.json

# Type-check frontend
cd nextjs-frontend && npx tsc --noEmit

# Run backend unit tests
npm run test

# Run e2e tests
npm run test:e2e
```

## License

MIT
