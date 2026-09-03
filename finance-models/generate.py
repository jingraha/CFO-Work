#!/usr/bin/env python3
"""Command-line entry point: generates all four Startup CFO OS Excel workbooks
into apps/web/public/downloads/.

Usage (from the finance-models/ directory):
    python generate.py                 # build all four workbooks
    python generate.py b2b_saas        # build just one model
    python generate.py --list          # list available model keys
"""
from __future__ import annotations

import argparse
import sys
import time
from pathlib import Path

THIS_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(THIS_DIR))

from models import b2b_saas, ai_api, consumer, ai_services  # noqa: E402

MODELS = {
    "b2b_saas": (b2b_saas, "b2b-saas-usage-model.xlsx"),
    "ai_api": (ai_api, "ai-api-infrastructure-model.xlsx"),
    "consumer": (consumer, "consumer-subscription-model.xlsx"),
    "ai_services": (ai_services, "ai-enabled-services-model.xlsx"),
}

DEFAULT_OUTPUT_DIR = (
    THIS_DIR / ".." / "apps" / "web" / "public" / "downloads"
).resolve()


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description="Generate Startup CFO OS Excel workbooks.")
    parser.add_argument("models", nargs="*", help="Model keys to build (default: all).",
                         choices=list(MODELS.keys()) + [], default=None)
    parser.add_argument("--out-dir", default=str(DEFAULT_OUTPUT_DIR), help="Output directory for .xlsx files.")
    parser.add_argument("--list", action="store_true", help="List available model keys and exit.")
    args = parser.parse_args(argv)

    if args.list:
        for key, (_, fname) in MODELS.items():
            print(f"{key:12s} -> {fname}")
        return 0

    keys = args.models or list(MODELS.keys())
    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    for key in keys:
        module, fname = MODELS[key]
        out_path = out_dir / fname
        t0 = time.time()
        print(f"Building {key} -> {out_path} ...", flush=True)
        module.build(str(out_path))
        dt = time.time() - t0
        size_kb = out_path.stat().st_size / 1024
        print(f"  done in {dt:.1f}s ({size_kb:.0f} KB)")

    print(f"\nGenerated {len(keys)} workbook(s) in {out_dir}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
