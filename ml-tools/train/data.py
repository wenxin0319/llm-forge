"""
Loads the same three JSONL schemas the website's dataset upload/finetune
wizard detects (see nextjs-frontend/src/app/finetune/page.tsx detectFormat
and src/datasets/dataset-parsers.ts) and converts them into what trl's
SFTTrainer / DPOTrainer expect natively.
"""
import json

from datasets import Dataset


def detect_format(path: str) -> str:
    with open(path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            obj = json.loads(line)
            if "messages" in obj or "conversations" in obj:
                return "chat"
            if "instruction" in obj and "output" in obj:
                return "alpaca"
            if "prompt" in obj and "chosen" in obj and "rejected" in obj:
                return "dpo"
            return "generic"
    raise ValueError(f"{path} is empty")


def _read_jsonl(path: str) -> list[dict]:
    rows = []
    with open(path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line:
                rows.append(json.loads(line))
    return rows


def load_sft_dataset(path: str) -> Dataset:
    """Returns a Dataset with either a 'messages' or 'text' column — both are
    natively understood by trl's SFTTrainer (it applies the tokenizer's chat
    template to 'messages' automatically)."""
    fmt = detect_format(path)
    rows = _read_jsonl(path)

    if fmt == "chat":
        examples = [{"messages": r.get("messages") or r["conversations"]} for r in rows]
        return Dataset.from_list(examples)

    if fmt == "alpaca":
        def to_messages(r):
            user_content = r["instruction"] if not r.get("input") else f"{r['instruction']}\n\n{r['input']}"
            return {"messages": [
                {"role": "user", "content": user_content},
                {"role": "assistant", "content": r["output"]},
            ]}
        return Dataset.from_list([to_messages(r) for r in rows])

    if fmt == "dpo":
        raise ValueError(f"{path} looks like a DPO dataset (prompt/chosen/rejected) — use dpo_train.py, not sft_train.py")

    raise ValueError(
        f"{path}: couldn't detect a supported schema. Expected one of: "
        "{'messages': [...]} (chat), {'instruction', 'output'} (alpaca), "
        "or {'prompt', 'chosen', 'rejected'} (DPO)."
    )


def load_dpo_dataset(path: str) -> Dataset:
    """Returns a Dataset with prompt/chosen/rejected columns for trl's DPOTrainer."""
    rows = _read_jsonl(path)
    missing = [i for i, r in enumerate(rows) if not ({"prompt", "chosen", "rejected"} <= r.keys())]
    if len(missing) > len(rows) * 0.1:
        raise ValueError(
            f"{path}: {len(missing)}/{len(rows)} rows are missing 'prompt'/'chosen'/'rejected' — "
            "not a valid DPO preference dataset."
        )
    rows = [r for i, r in enumerate(rows) if i not in missing]
    return Dataset.from_list([{"prompt": r["prompt"], "chosen": r["chosen"], "rejected": r["rejected"]} for r in rows])
