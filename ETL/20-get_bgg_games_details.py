import re

from tqdm import tqdm
import pandas as pd
from xml.etree import ElementTree as ET

from bgg import fetch, append_csv, PROCESSED_DIR

BATCH_SIZE = 20

RANKS       = PROCESSED_DIR / "boardgames_ranks_cleaned.csv"
OUTPUT      = PROCESSED_DIR / "boardgames_details.csv"
NEW_DETAILS = PROCESSED_DIR / "games_details.csv" 

LINKS = {"mechanics": "boardgamemechanic", "categories": "boardgamecategory", "designers": "boardgamedesigner",
         "families": "boardgamefamily"}
DETAIL_COLUMNS = ["id", "min_playtime", "max_playtime", "age", "min_players", "max_players", "weight", "best_min", "best_max",
                  *LINKS, "image", "thumbnail"]

def get_games_details(game_ids):
    """Fetch the details of several games in a single request."""
    url = f"https://boardgamegeek.com/xmlapi2/thing?id={','.join(map(str, game_ids))}&stats=1"
    root = ET.fromstring(fetch(url).content)
    return [parse_item(item) for item in root.findall("item")]


def parse_item(item):

    best = item.find("poll-summary/result[@name='bestwith']")
    best_numbers = [int(n) for n in re.findall(r"\d+", best.get("value"))] if best is not None else []
    best_min = int(min(best_numbers)) if best_numbers else None
    best_max = int(max(best_numbers)) if best_numbers else None

    return {
        "id"           : int(item.get("id")),
        "min_playtime" : int(item.find("minplaytime").get("value")),
        "max_playtime" : int(item.find("maxplaytime").get("value")),
        "age"          : int(item.find("minage").get("value")),
        "min_players"  : int(item.find("minplayers").get("value")),
        "max_players"  : int(item.find("maxplayers").get("value")),
        "weight"       : float(item.find("statistics/ratings/averageweight").get("value")),
        "best_min"     : best_min,
        "best_max"     : best_max,
        **{column: "|".join(link.get("value") for link in item.findall(f"link[@type='{link_type}']"))
           for column, link_type in LINKS.items()},
        "image"        : item.findtext("image"),        
        "thumbnail"    : item.findtext("thumbnail")
    }

def known_details():
    frames = [pd.read_csv(path, usecols=lambda column: column in DETAIL_COLUMNS) for path in [OUTPUT, NEW_DETAILS] if path.exists()]
    frames = [frame for frame in frames if len(frame.columns) == len(DETAIL_COLUMNS)]
    return pd.concat(frames).drop_duplicates("id") if frames else pd.DataFrame(columns=DETAIL_COLUMNS)

def update_details(ids):
    """Fetch only the games without details, writing each batch as soon as it arrives."""
    done = set(known_details().id)
    new_ids = [i for i in ids if i not in done]
    for i in tqdm(range(0, len(new_ids), BATCH_SIZE)):
        append_csv(get_games_details(new_ids[i:i + BATCH_SIZE]), NEW_DETAILS)

if __name__ == "__main__":
    games_df = pd.read_csv(RANKS)
    update_details(games_df['id'].tolist())

    games_df.merge(known_details(), on="id", how="left").to_csv(OUTPUT, index=False)
    RANKS.unlink()
    NEW_DETAILS.unlink(missing_ok=True)
