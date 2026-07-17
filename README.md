# LLM Forge

> Build your own AI model — no PhD required. Upload your data, pick a model, and get a production-ready custom LLM in minutes.

[![Live Demo](https://img.shields.io/badge/Try%20it%20live-llm--forge--azure.vercel.app-brightgreen)](https://llm-forge-azure.vercel.app/)
![License](https://img.shields.io/badge/license-MIT-blue)

**Live at:** [https://llm-forge-azure.vercel.app](https://llm-forge-azure.vercel.app/)

---

## Current implementation status

The public web training flow remains **simulated**. The repository contains
standalone Hugging Face `trl`/PEFT training scripts under `ml-tools/train/`,
but they are not yet fully connected to the NestJS job backend: browser-launched
jobs still use timer-driven progress and generated loss curves. A real CUDA
QLoRA run on rented GPU infrastructure has **not** yet been completed.

Dataset parsing is real, and the backend can collect real NVIDIA telemetry via
`nvidia-smi` when it runs on a GPU host. Neither of those milestones means the
platform currently provisions a GPU or executes training. On hosts without
NVIDIA telemetry, the cluster endpoint returns an explicitly labeled demo
fallback.

The dated component-by-component status and evidence requirements are tracked
in [`docs/roadmap-status.md`](docs/roadmap-status.md).

---

## What can I do with LLM Forge?

LLM Forge lets you take a powerful open-source AI model and train it on your own data — so it speaks your language, knows your domain, and works the way you need it to.

**Common use cases:**

- Fine-tune a medical AI on your clinical notes
- Train a customer support bot on your product documentation
- Build a coding assistant specialized for your codebase
- Create a multilingual assistant trained on your content

No GPU setup. No infrastructure. Just upload, configure, and launch.

---

## How to use it — tab by tab

### 1. Model Catalog

**Start here.** Browse 14 curated open-source models — from small (7B, runs on a laptop) to powerful (70B+, frontier-quality). Each card shows:

- How much memory (VRAM) it needs
- What it's best at (chat, coding, reasoning, multilingual)
- Its license (Apache 2.0, MIT, or Meta Community)

Click **"Fine-tune this model"** on any card to begin.

> **Not sure which to pick?** Mistral 7B is a great starting point — fast, free, and works well on most tasks.

---

### 2. Datasets

**Upload your training data here.** Drag and drop a file — LLM Forge auto-detects the format.

| Format                | When to use                                  |
| --------------------- | -------------------------------------------- |
| **JSONL**             | Instruction/answer pairs, chat conversations |
| **CSV**               | Structured data with rows and columns        |
| **Plain text (.txt)** | Documents, articles, clinical notes          |
| **Parquet**           | Large datasets exported from data pipelines  |

**Sample datasets to try** (in `sample-datasets/emr/`):

- `clinical-notes.jsonl` — 8 clinical NLP examples (instruction → output format)
- `patient-records.csv` — 15 fictional patient records
- `discharge-summaries.txt` — 3 full hospital discharge documents
- `medication-events.jsonl` — 6 pharmacist assistant training examples

Once uploaded, your dataset appears in the table with its size, record count, and status.

---

### 3. Fine-tune (3-step wizard)

**Step 1 — Pick your dataset**
Select the file you uploaded. LLM Forge previews the first few rows so you can confirm it looks right.

**Step 2 — Configure training**

- **Method:** QLoRA is recommended for most people — uses 75% less GPU memory with minimal quality loss
- **GPU tier:** Choose based on your model size and budget
- **Epochs, learning rate, batch size:** Defaults work well; advanced users can tune these

The cost estimator shows you what the run will cost before you launch.

**Step 3 — Review & Launch**
See a summary of everything, then click **Launch Fine-tune**. You'll be taken directly to the live training monitor.

---

### 4. Training Monitor (Jobs)

**Watch your model train in real time.** The monitor shows:

- **Loss curve** — the model's error rate dropping over time (lower = better)
- **Live logs** — step-by-step output from the training process
- **GPU utilization** — how hard the cluster is working
- **Epoch progress** — how far through training you are

Training typically takes 10–60 minutes depending on dataset size and model. You'll get a notification when it's done.

---

### 5. Model Artifacts (Download)

**Your finished model lives here.** After training completes, you'll see download options:

| Format              | What it is                           | Run with                |
| ------------------- | ------------------------------------ | ----------------------- |
| **Adapter weights** | Small patch on top of the base model | Merge at inference time |
| **Merged FP16**     | Full model, ready to serve           | Any inference server    |
| **GGUF Q4_K_M**     | Compressed for local use             | Ollama, LM Studio       |
| **GPTQ INT4**       | GPU-optimized quantization           | vLLM, TGI               |

Click **Quantize to GGUF** to convert your model for Ollama in one click.

---

### 6. GPU Cluster

**See what's running under the hood.** A live grid of 20 GPU nodes — you can see which ones are handling your jobs, their current utilization, memory usage, and temperature. No action needed here; it's for visibility.

---

### 7. Settings

**Manage your account and API access.** Copy your API key here to call your trained model from your own application.

---

### 8. Admin Panel _(admin accounts only)_

**Wenxin Cheng's view.** Lists all registered users, their plans, GPU quota usage, and when they joined. Accessible at `/admin`.

---

## Try it now — no setup needed

Visit **[https://llm-forge-azure.vercel.app](https://llm-forge-azure.vercel.app/)** and sign in:

| Account   | Email               | Password   |
| --------- | ------------------- | ---------- |
| Demo user | `demo@llmforge.ai`  | `demo1234` |
| Admin     | `cwx0319@gmail.com` | `demo1234` |

The demo works without a backend — training jobs simulate real progress, loss curves animate, and the EMR dataset is pre-loaded.

---

## Run it yourself

### Frontend only (demo mode — no backend needed)

```bash
git clone https://github.com/wenxin0319/llm-forge.git
cd llm-forge/nextjs-frontend
npm install
npm run dev
# Open http://localhost:3000
```

### Full stack (real accounts/uploads; simulated training jobs)

```bash
# Start Postgres
docker run -d --name llmforge-db \
  -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=llmforge \
  -p 5432:5432 postgres:16-alpine

# Terminal 1 — Backend
cd llm-forge
npm install
export JWT_SECRET='replace-with-a-long-random-secret'
# Optional: auto (default), real (fail if nvidia-smi is unavailable), or mock
export GPU_METRICS_MODE=auto
npm run start:dev
# API: http://localhost:3001  |  Docs: http://localhost:3001/api/docs

# Terminal 2 — Frontend
cd llm-forge/nextjs-frontend
npm install
npm run dev
# UI: http://localhost:3000
```

---

## Deployment

Credential inventory, initial setup, password/JWT/database rotation, and the
redacted screenshot checklist are documented in
[`docs/deployment-secrets.md`](docs/deployment-secrets.md).

| Service  | Platform | URL                                                               |
| -------- | -------- | ----------------------------------------------------------------- |
| Frontend | Vercel   | [llm-forge-azure.vercel.app](https://llm-forge-azure.vercel.app/) |
| Backend  | Railway  | Auto-deploys from `main` branch                                   |

Both deploy automatically on every push to `main`.

### Deploy your own instance

**Backend → Railway**

1. New Project → Deploy from GitHub → select `wenxin0319/llm-forge`
2. Add variables: `JWT_SECRET`, `FRONTEND_URL=https://your-app.vercel.app`
   and `GPU_METRICS_MODE=real` on a GPU host (`mock` for a public demo without
   attached GPUs). Set `ADMIN_EMAIL` and `ADMIN_PASSWORD` only when the
   deployment should bootstrap or rotate an administrator account.
3. Copy the Railway domain after deploy

**Frontend → Vercel**

1. Add New Project → set Root Directory to `nextjs-frontend`
2. Add variable: `NEXT_PUBLIC_API_URL=https://your-backend.railway.app/api/v1`
3. Deploy

---

## Tech stack

| Layer      | Technology              |
| ---------- | ----------------------- |
| Frontend   | Next.js 15 (App Router) |
| Backend    | NestJS + TypeORM        |
| Database   | PostgreSQL              |
| Auth       | JWT (7-day tokens)      |
| Deployment | Vercel + Railway        |

---

## License

MIT
