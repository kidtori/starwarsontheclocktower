"""Private, offline Laya inference child. JSON lines over pipes; no HTTP server."""
import contextlib
import json
import os
import sys
import traceback
from pathlib import Path

os.environ.update(HF_HUB_OFFLINE="1", TRANSFORMERS_OFFLINE="1", TOKENIZERS_PARALLELISM="false")
sys.stdin.reconfigure(encoding="utf-8")
sys.stdout.reconfigure(encoding="utf-8")
def clean(value):
    if isinstance(value, str):
        return value.encode("utf-8", errors="replace").decode("utf-8")
    if isinstance(value, dict):
        return {clean(k): clean(v) for k, v in value.items()}
    if isinstance(value, list):
        return [clean(v) for v in value]
    return value
with contextlib.redirect_stdout(sys.stderr):
    import torch
    import laya
    torch.set_num_threads(min(4, os.cpu_count() or 1))
    model = laya.load(str(Path(__file__).resolve().parents[1] / "runtime" / "laya-model"), device="cpu")

for line in sys.stdin:
    try:
        request = clean(json.loads(line))
        with contextlib.redirect_stdout(sys.stderr):
            state = request["state"]
            if not isinstance(state, str):
                state = json.dumps(state, ensure_ascii=False)
            result = model.predict(state=state, questions=request["questions"])
        print(json.dumps({"id": request["id"], "result": result}), flush=True)
    except Exception as exc:
        traceback.print_exc(file=sys.stderr)
        print(json.dumps({"id": request.get("id"), "error": str(exc)}), flush=True)
