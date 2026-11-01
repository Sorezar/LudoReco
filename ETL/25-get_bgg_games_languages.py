from collections import Counter

from tqdm import tqdm
import pandas as pd
from xml.etree import ElementTree as ET

from bgg import fetch, append_csv, PROCESSED_DIR

BATCH_SIZE   = 20
RECENT_YEARS = 10

CATALOG   = PROCESSED_DIR / "boardgames_details.csv"
OUTPUT    = PROCESSED_DIR / "boardgames_languages.csv"
LANGUAGES = {"fr": "French", "de": "German", "es": "Spanish", "it": "Italian"}  # code used by the interface -> BGG language

def get_games_languages(game_ids):
    url  = f"https://boardgamegeek.com/xmlapi2/thing?id={','.join(map(str, game_ids))}&versions=1"
    root = ET.fromstring(fetch(url).content)
    return [parse_item(item) for item in root.findall("item")]

def parse_item(item):
    versions = []
    for version in item.findall("versions/item"):
        year = version.find("yearpublished")
        versions.append({
            "languages" : {link.get("value") for link in version.findall("link[@type='language']")},
            "name"      : " ".join((version.find("canonicalname").get("value") if version.find("canonicalname") is not None else "").replace("\\'", "'").split()),
            "year"      : int(year.get("value")) if year is not None and year.get("value", "").lstrip("-").isdigit() else 0,
            "image"     : version.findtext("image"),
            "thumbnail" : version.findtext("thumbnail"),
        })

    row = {"id": int(item.get("id"))}
    for code, language in LANGUAGES.items():
        editions = [v for v in versions if v["languages"] == {language}] or [v for v in versions if language in v["languages"]]
        latest   = max((v["year"] for v in editions), default=0)
        names    = Counter(v["name"] for v in editions if v["name"] and v["year"] >= latest - RECENT_YEARS)
        pictured = sorted((v for v in editions if v["image"]), key=lambda v: v["year"])

        row[f"name_{code}"] = names.most_common(1)[0][0] if names else None
        row[f"image_{code}"] = pictured[-1]["image"] if pictured else None
        row[f"thumbnail_{code}"] = pictured[-1]["thumbnail"] if pictured else None

    return row

if __name__ == "__main__":
    ids     = pd.read_csv(CATALOG, usecols=["id"]).id
    done    = set(pd.read_csv(OUTPUT, usecols=["id"]).id) if OUTPUT.exists() else set()
    new_ids = [i for i in ids if i not in done]
    for i in tqdm(range(0, len(new_ids), BATCH_SIZE)):
        append_csv(get_games_languages(new_ids[i:i + BATCH_SIZE]), OUTPUT)
