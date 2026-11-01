# Recommendation API (build context: the project root, for pyproject.toml and model/)
FROM python:3.12-slim
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

WORKDIR /app

# OpenMP, needed by LightGBM
RUN apt-get update && apt-get install -y --no-install-recommends libgomp1 && rm -rf /var/lib/apt/lists/*

# PyTorch (RecVAE) and LightGBM (LambdaRank) only score the players here: the CPU build of PyTorch is enough
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev

COPY model/ model/
COPY ETL/bgg.py ETL/bgg.py
COPY api/ api/

EXPOSE 8000
CMD ["uv", "run", "--no-sync", "uvicorn", "api.main:app", "--host", "0.0.0.0", "--port", "8000"]
