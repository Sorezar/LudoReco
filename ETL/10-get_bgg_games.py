import os
import re
import html
import zipfile
import pandas as pd

import requests

from bgg import RAW_DIR, PROCESSED_DIR, USER_AGENT

# Extract
URL = "https://boardgamegeek.com/data_dumps/bg_ranks"
LOGIN_URL = "https://boardgamegeek.com/login/api/v1"

# Transform
THRESHOLD = 300

def get_zip_link(session=None):
    session = session or requests.Session()
    session.headers.update({"User-Agent": USER_AGENT})

    response = session.post(
        LOGIN_URL,
        json={
            "credentials": {
                "username": os.environ["BGG_USERNAME"],
                "password": os.environ["BGG_PASSWORD"],
            }
        },
    )
    response.raise_for_status()

    response = session.get(URL)
    response.raise_for_status()

    match = re.search(r'href="([^"]+\.zip[^"]*)"', response.text)
    if match is None:
        raise RuntimeError("Zip link not found on the page (invalid credentials?)")

    return html.unescape(match.group(1))


def extract():
    session  = requests.Session()
    zip_link = get_zip_link(session)
    response = session.get(zip_link)
    response.raise_for_status()

    RAW_DIR.mkdir(parents=True, exist_ok=True)
    zip_path = RAW_DIR / "bg_ranks.zip"
    with open(zip_path, "wb") as f:
        f.write(response.content)

    with zipfile.ZipFile(zip_path, "r") as zip_ref:
        zip_ref.extractall(RAW_DIR)

    os.remove(zip_path)

def transform():
    df = pd.read_csv(RAW_DIR / "boardgames_ranks.csv")
    df = df[df['is_expansion'] == 0]
    df = df[df['usersrated'] >= THRESHOLD]

    rank_columns = [col for col in df.columns if col.endswith('_rank')]
    for col in rank_columns:
        new_col = 'is_' + col.replace('_rank', '')
        df[new_col] = df[col].apply(lambda x: 1 if pd.notnull(x) else 0)

    df = df.drop(columns=rank_columns + ["rank", "is_expansion"])

    df.to_csv(PROCESSED_DIR / "boardgames_ranks_cleaned.csv", index=False)    

if __name__ == "__main__":
    extract()
    transform()

    