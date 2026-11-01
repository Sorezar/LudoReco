import numpy as np
import pandas as pd
from tqdm import tqdm
from xml.etree import ElementTree as ET

from bgg import fetch, append_csv, PROCESSED_DIR

PAGE_SIZE  = 100
BATCH_SIZE = 20
MAX_PAGES  = None  # None = all of them
PAGE_ORDER = np.random.default_rng(0).permutation(20000) + 1

GAMES   = PROCESSED_DIR / "boardgames_details.csv"
RATINGS = PROCESSED_DIR / "games_ratings.csv"
PAGES   = PROCESSED_DIR / "games_ratings_pages.csv"

def plan(games_df):
    plan = {}
    for game_id, nb_pages in zip(games_df.id, -(-games_df.usersrated // PAGE_SIZE)):
        for page in PAGE_ORDER[PAGE_ORDER <= nb_pages][:MAX_PAGES]:
            plan.setdefault(int(page), []).append(game_id)
    return plan

def get_page(game_ids, page):
    url = f"https://boardgamegeek.com/xmlapi2/thing?id={','.join(map(str, game_ids))}&ratingcomments=1&page={page}&pagesize={PAGE_SIZE}"
    root = ET.fromstring(fetch(url).content)
    return [{
        "username": comment.get("username"),
        "game_id": int(item.get("id")),
        "rating": float(comment.get("rating"))
    } for item in root.findall("item") for comment in item.findall("comments/comment")]

def update_ratings(games_df):
    done = set(pd.read_csv(PAGES).itertuples(index=False, name=None)) if PAGES.exists() else set()
    batches = []
    for page, game_ids in sorted(plan(games_df).items()):
        todo = [g for g in game_ids if (g, page) not in done]
        batches += [(page, todo[i:i + BATCH_SIZE]) for i in range(0, len(todo), BATCH_SIZE)]

    for page, game_ids in tqdm(batches):
        append_csv(get_page(game_ids, page), RATINGS)
        append_csv([{"game_id": g, "page": page} for g in game_ids], PAGES)

if __name__ == "__main__":
    update_ratings(pd.read_csv(GAMES))
