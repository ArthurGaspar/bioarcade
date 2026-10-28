"""Minimal Ensembl REST client with a disk cache (https://rest.ensembl.org).

Ensembl is free and needs no key, but it can be slow, so every response is
cached under pipeline/cache and a gene is only downloaded once.
"""

import hashlib
import json
import time
from pathlib import Path

import requests

BASE = "https://rest.ensembl.org"
CACHE = Path(__file__).resolve().parent / "cache"
HEADERS = {"Content-Type": "application/json", "Accept": "application/json"}


def _cached(key: str, fetch) -> dict | list:
    path = CACHE / (hashlib.sha1(key.encode()).hexdigest() + ".json")
    if path.exists():
        return json.loads(path.read_text(encoding="utf-8"))
    data = fetch()
    CACHE.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data), encoding="utf-8")
    return data


def _request(method: str, path: str, **kwargs) -> dict | list:
    for attempt in range(4):
        resp = requests.request(method, BASE + path, headers=HEADERS, timeout=120, **kwargs)
        if resp.status_code == 429 or resp.status_code >= 500:
            time.sleep(float(resp.headers.get("Retry-After", 2 * (attempt + 1))))
            continue
        resp.raise_for_status()
        return resp.json()
    resp.raise_for_status()
    raise RuntimeError(f"Ensembl kept failing for {path}")


def gene(symbol: str) -> dict:
    """Gene record with its transcripts and exons."""
    return _cached(f"lookup:{symbol}", lambda: _request("GET", f"/lookup/symbol/homo_sapiens/{symbol}", params={"expand": 1}))


def sequences(ids: list[str]) -> dict[str, str]:
    """Genomic sequences (5'->3' on the feature's own strand) for up to 50 ids per request."""
    out: dict[str, str] = {}
    for i in range(0, len(ids), 50):
        chunk = ids[i : i + 50]
        rows = _cached(
            "seq:" + ",".join(chunk),
            lambda chunk=chunk: _request("POST", "/sequence/id", data=json.dumps({"ids": chunk, "type": "genomic"})),
        )
        out.update({r["id"]: r["seq"].upper() for r in rows})
    return out


def canonical_transcript(g: dict) -> dict:
    ts = g.get("Transcript", [])
    return next((t for t in ts if t.get("is_canonical")), max(ts, key=lambda t: t["end"] - t["start"]))
