"""
Bridges HF Trainer's real logging into the exact MetricPoint shape the
backend already expects (see MetricPoint in src/jobs/jobs.service.ts) — this
is the shape jobs.service.ts fabricates today via setTimeout and Math.random.
Wiring a real GPU job runner to append these lines to a job's `metrics` array
instead of the simulated ones is the remaining integration step; this
callback produces the real numbers to plug in.

gpuUtilPct / gpuMemUsedGb are intentionally left empty here — those come from
nvidia-smi/DCGM polling next to the training process (the "GPU cluster
monitoring" roadmap item), not from anything the Trainer itself knows.
"""
import json
import os
import time

from transformers import TrainerCallback


class MetricPointCallback(TrainerCallback):
    def __init__(self, log_path: str):
        self.log_path = log_path
        self._last_time_s: float | None = None
        self._last_tokens_seen = 0
        os.makedirs(os.path.dirname(log_path) or ".", exist_ok=True)
        open(log_path, "w").close()

    def on_log(self, args, state, control, logs=None, **kwargs):
        if not logs or ("loss" not in logs and "eval_loss" not in logs):
            return

        now_s = time.time()
        tokens_seen = getattr(state, "num_input_tokens_seen", 0) or 0

        tokens_per_sec = None
        if self._last_time_s is not None:
            dt = now_s - self._last_time_s
            if dt > 0 and tokens_seen > self._last_tokens_seen:
                tokens_per_sec = (tokens_seen - self._last_tokens_seen) / dt

        point = {
            "step": state.global_step,
            "epoch": round(state.epoch, 4) if state.epoch is not None else 0,
            "timestampMs": int(now_s * 1000),
            "trainLoss": logs.get("loss"),
            "valLoss": logs.get("eval_loss"),
            "learningRate": logs.get("learning_rate"),
            "tokensPerSec": tokens_per_sec,
            "stepsPerSec": None,
            "gpuUtilPct": [],
            "gpuMemUsedGb": [],
        }
        with open(self.log_path, "a", encoding="utf-8") as f:
            f.write(json.dumps(point) + "\n")

        self._last_time_s = now_s
        self._last_tokens_seen = tokens_seen
