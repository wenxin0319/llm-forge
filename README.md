# LLM Forge

> Open-source platform for training customized, lightweight LLMs on your own data — with GPU acceleration and parallel training out of the box.

![License](https://img.shields.io/badge/license-MIT-blue)
![Node](https://img.shields.io/badge/node-18%2B-brightgreen)
![NestJS](https://img.shields.io/badge/backend-NestJS-e0234e)
![React](https://img.shields.io/badge/frontend-React%20%2B%20Vite-61dafb)

## Overview

LLM Forge lets you upload your own datasets, configure a base model, and launch distributed fine-tuning jobs against a managed GPU cluster — all from a polished web UI or the REST API.

- **Upload datasets** — JSONL, CSV, Parquet, or plain text up to 5 GB
- **Configure models** — pick a base (Llama 3, Mistral, Phi-3, Gemma) and quantization (INT4, INT8, GGUF, GPTQ)
- **Launch training jobs** — QLoRA, LoRA, or full fine-tune across H100 / A100 / RTX 4090 nodes
- **Monitor in real time** — live loss curves, epoch logs, GPU utilization, VRAM, power draw
- **Cost estimation** — see predicted GPU-hours and USD cost before you commit

## Architecture

```
llm-forge/
├── src/                    # NestJS backend (port 3001)
│   ├── auth/               # JWT authentication
│   ├── users/              # User accounts & GPU quota
│   ├── datasets/           # Dataset upload & processing
│   ├── models/             # LLM model configuration
│   ├── training/           # Training job orchestration
│   ├── jobs/               # Job lifecycle & log streaming
│   └── gpu-metrics/        # Cluster utilization metrics
└── frontend/               # React + Vite UI (port 5173)
    └── src/
        ├── pages/          # Dashboard, Datasets, Models, Training, GPU Cluster
        └── components/     # Sidebar, shared UI
```

## Getting Started

### Prerequisites

- Node.js 18+
- npm 9+

### Install & run

```bash
# 1. Clone
git clone https://github.com/wenxin0319/llm-forge.git
cd llm-forge

# 2. Backend
cp .env.example .env
npm install
npm run start:dev        # http://localhost:3001
                         # Swagger docs: http://localhost:3001/api/docs

# 3. Frontend (separate terminal)
cd frontend
cp .env.example .env
npm install
npm run dev              # http://localhost:5173
```

### Environment variables

**Backend `.env`**

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3001` | API server port |
| `JWT_SECRET` | `llmforge-dev-secret` | Change this in production |
| `FRONTEND_URL` | `http://localhost:5173` | CORS allowed origin |

**Frontend `.env`**

| Variable | Default | Description |
|---|---|---|
| `VITE_API_URL` | `http://localhost:3001/api/v1` | Backend API base URL |

## API Reference

Full interactive docs are available at `/api/docs` (Swagger UI) when the server is running.

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/v1/auth/register` | Create account |
| `POST` | `/api/v1/auth/login` | Login, receive JWT |
| `GET` | `/api/v1/auth/me` | Current user profile |
| `POST` | `/api/v1/datasets` | Upload dataset (multipart) |
| `GET` | `/api/v1/datasets` | List datasets |
| `POST` | `/api/v1/models` | Create model config |
| `GET` | `/api/v1/models` | List models |
| `POST` | `/api/v1/training/launch` | Launch training job |
| `GET` | `/api/v1/jobs` | List all jobs |
| `GET` | `/api/v1/jobs/:id` | Job status + logs |
| `POST` | `/api/v1/jobs/:id/cancel` | Cancel a running job |
| `GET` | `/api/v1/gpu-metrics/cluster` | Full cluster metrics |

All protected endpoints require `Authorization: Bearer <token>`.

## Supported Models & Quantization

| Base Model | Parameters | Quantization options |
|---|---|---|
| Llama 3 8B | 8B | FP16, INT8, INT4, GPTQ, GGUF |
| Llama 3 70B | 70B | FP16, INT8, INT4, GPTQ, GGUF |
| Mistral 7B | 7B | FP16, INT8, INT4, GPTQ, GGUF |
| Phi-3 Mini | 3.8B | FP16, INT8, INT4, GPTQ, GGUF |
| Gemma 2B | 2B | FP16, INT8, INT4, GPTQ, GGUF |
| Gemma 7B | 7B | FP16, INT8, INT4, GPTQ, GGUF |

INT4 / GGUF reduces model size ~4× vs FP16 with minimal quality loss for most fine-tuning tasks.

## Training Methods

| Method | Description | VRAM savings |
|---|---|---|
| QLoRA | Quantized LoRA — recommended starting point | ~70% |
| LoRA | Low-rank adaptation — fast, parameter-efficient | ~40% |
| Full fine-tune | All weights updated — highest quality | none |
| Prefix tuning | Trains only prefix tokens | ~80% |

## GPU Cluster

The platform manages a heterogeneous cluster:

- 4× **H100 SXM5 80GB** — 989 TFLOPs, 900 GB/s NVLink
- 8× **A100 SXM4 80GB** — 312 TFLOPs, 600 GB/s NVLink
- 8× **A100 SXM4 40GB** — 312 TFLOPs

GPU utilization, VRAM usage, temperature, and power draw are streamed to the dashboard in real time.

## Contributing

Pull requests are welcome. For major changes, open an issue first.

```bash
# Run backend tests
npm run test

# Run e2e tests
npm run test:e2e
```

## License

MIT
