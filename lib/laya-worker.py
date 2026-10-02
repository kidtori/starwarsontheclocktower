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
    from laya.common import build_sequence
    torch.set_num_threads(min(4, os.cpu_count() or 1))
    model = laya.load(str(Path(__file__).resolve().parents[1] / "runtime" / "laya-model"), device="cpu")

for line in sys.stdin:
    try:
        request = clean(json.loads(line))
        with contextlib.redirect_stdout(sys.stderr):
            state = request["state"]
            if not isinstance(state, str):
                state = json.dumps(state, ensure_ascii=False)
            max_len = model.cfg.get("max_len", 512)
            head_max_len = model.cfg.get("head_max_len", 192)
            context = {}
            for key, question in request["questions"].items():
                internal = model._to_internal(question)
                prefix, _ = build_sequence(model.tok, "", internal, max_len, head_max_len)
                budget = max_len - len(prefix)
                tokens = len(model.tok(state.replace(model.tok.mask_token, " "), add_special_tokens=False)["input_ids"])
                context[key] = {"tokens": tokens, "budget": budget, "truncated": tokens > budget}
            result = model.predict(state=state, questions=request["questions"])
            result["context"] = context.get("selection", next(iter(context.values()), {}))
        print(json.dumps({"id": request["id"], "result": result}), flush=True)
    except Exception as exc:
        traceback.print_exc(file=sys.stderr)
        print(json.dumps({"id": request.get("id"), "error": str(exc)}), flush=True)
