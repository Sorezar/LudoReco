import os
import time
from pathlib import Path

import requests
import pandas as pd
from tqdm import tqdm
from dotenv import load_dotenv

load_dotenv()

RAW_DIR       = Path(__file__).parent.parent / "data" / "raw"
PROCESSED_DIR = Path(__file__).parent.parent / "data" / "processed"
USER_AGENT    = "Mozilla/5.0 (BoardGameRecommender)"

MIN_DELAY     = 0.1
MAX_DELAY     = 60.0
QUEUE_DELAY   = 3.0 
delay         = MIN_DELAY

def fetch(url):
    global delay
    headers = {
        "Authorization": f"Bearer {os.environ['BGC_BEARER_TOKEN']}",
        "User-Agent": USER_AGENT
    }
    while True:
        time.sleep(delay)
        try:
            response = requests.get(url, headers=headers, timeout=30)
        except (requests.Timeout, requests.ConnectionError) as error:
            delay = min(MAX_DELAY, delay * 2)
            tqdm.write(f"{type(error).__name__}, new delay: {delay:.1f}s")
            continue

        if response.status_code == 202:
            time.sleep(QUEUE_DELAY)
            continue

        if response.status_code == 429:
            retry_after = response.headers.get("Retry-After", "")
            delay = min(MAX_DELAY, float(retry_after) if retry_after.isdigit() else delay * 2)
            tqdm.write(f"429 received, new delay: {delay:.1f}s")
            continue

        response.raise_for_status()
        delay = max(MIN_DELAY, delay * 0.9)
        return response

def append_csv(rows, path):
    if rows:
        pd.DataFrame(rows).to_csv(path, mode="a", header=not path.exists(), index=False)
