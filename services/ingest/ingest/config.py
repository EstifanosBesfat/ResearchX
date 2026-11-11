from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv

PACKAGE_ROOT = Path(__file__).resolve().parents[1]
REPO_ROOT = Path(__file__).resolve().parents[3]
load_dotenv(REPO_ROOT / ".env")
load_dotenv(PACKAGE_ROOT / ".env")

DATABASE_URL = os.environ.get("DATABASE_URL", "")
EMBEDDING_BASE_URL = os.environ.get("EMBEDDING_BASE_URL", "https://api.openai.com/v1").rstrip("/")
EMBEDDING_API_KEY = os.environ.get("EMBEDDING_API_KEY") or os.environ.get("OPENAI_API_KEY") or ""
EMBEDDING_MODEL = os.environ.get("EMBEDDING_MODEL", "text-embedding-3-small")
EMBEDDING_DIMENSION = int(os.environ.get("EMBEDDING_DIMENSION", "1536"))
EMBEDDING_SEND_DIMENSIONS = os.environ.get("EMBEDDING_SEND_DIMENSIONS", "")
LLM_BASE_URL = (os.environ.get("LLM_BASE_URL") or EMBEDDING_BASE_URL).rstrip("/")
LLM_API_KEY = os.environ.get("LLM_API_KEY") or os.environ.get("OPENAI_API_KEY") or EMBEDDING_API_KEY
LLM_MODEL = os.environ.get("LLM_MODEL", "gpt-4o-mini")
SEED_PATH = PACKAGE_ROOT / "seed" / "papers.json"
CACHE_DIR = PACKAGE_ROOT / ".cache"

if EMBEDDING_DIMENSION != 1536:
    raise SystemExit("EMBEDDING_DIMENSION must be 1536 so ingest and query share one vector size.")
