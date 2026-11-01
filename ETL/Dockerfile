FROM python:3.12-slim
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

WORKDIR /app

# The ETL only fetches and cleans data: the model libraries are left out of the image
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev --no-install-package torch --no-install-package lightgbm --no-install-package scikit-learn

COPY ETL/ ETL/

# Run the ETL scripts in order (10, 20, 30) and stop at the first failure
CMD ["sh", "-c", "for script in ETL/[0-9]*.py; do uv run --no-sync \"$script\" || exit 1; done"]
