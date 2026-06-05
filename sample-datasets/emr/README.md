# EMR Sample Datasets

Sample datasets for testing LLM Forge's upload and fine-tuning pipeline with clinical/medical data.

> All patient data is **entirely fictional** — generated for testing purposes only.

## Files

| File | Format | Records | Use case |
|---|---|---|---|
| `clinical-notes.jsonl` | JSONL Alpaca | 8 | Fine-tune for clinical NLP tasks (extraction, summarization, triage) |
| `patient-records.csv` | CSV | 15 | Structured patient data — admission, discharge, diagnoses, medications |
| `discharge-summaries.txt` | Plain text | 3 full summaries | Continued pre-training on clinical document style |
| `medication-events.jsonl` | JSONL Chat (OpenAI messages format) | 6 | Fine-tune a clinical pharmacist assistant |

## How to use

1. Start the backend: `cd llm-forge && npm run start:dev`
2. Start the frontend: `cd llm-forge/nextjs-frontend && npm run dev`
3. Login at `http://localhost:3000`
4. Go to **Datasets** → **Upload Dataset**
5. Drag and drop any file from this folder
6. The platform auto-detects the format (JSONL, CSV, or plain text)

## Recommended fine-tuning setup

| Dataset | Suggested model | Method | Use case |
|---|---|---|---|
| `clinical-notes.jsonl` | Llama 3.1 8B or Mistral 7B | QLoRA | Clinical information extraction |
| `medication-events.jsonl` | Phi-4 | QLoRA | Clinical decision support chatbot |
| `patient-records.csv` | Any | LoRA | Structured data analysis |
| `discharge-summaries.txt` | Llama 3.1 8B | Full fine-tune | Clinical document generation |
