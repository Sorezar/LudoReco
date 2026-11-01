"""Web API of the recommender, used by the interface in web/.

Recommendations of model/serving.py (EASE mixed with the most liked games with few ratings, LambdaRank from 3 ratings on),
filtered by the player's answers. Games are described in the interface's language when BGG knows a local edition
(title and box, fetched by ETL/25-get_bgg_games_languages.py), in English otherwise.
The model must have been trained first: uv run python -m model.train
Run locally, from the project root: uv run uvicorn api.main:app --reload
"""
from typing import Annotated, Literal
from urllib.parse import quote
from xml.etree import ElementTree as ET

import numpy as np
import pandas as pd
from fastapi import FastAPI, HTTPException, Query
from pydantic import BaseModel, Field

from ETL.bgg import fetch
from model.data import PROCESSED_DIR
from model.serving import load_model, matching, recommend, suggestions

model = load_model()
games = model.games
catalog = pd.read_csv(PROCESSED_DIR / "boardgames_details.csv").set_index("id").loc[games]
LANGUAGES_FILE = PROCESSED_DIR / "boardgames_languages.csv"
if LANGUAGES_FILE.exists():
    catalog = catalog.join(pd.read_csv(LANGUAGES_FILE).drop_duplicates("id").set_index("id"))
LANGUAGES = ["en"] + [column.removeprefix("name_") for column in catalog.columns if column.startswith("name_")]
Language = Annotated[str, Query(description="interface language: " + ", ".join(LANGUAGES))]
by_popularity = games[np.argsort(-model.stage.liked_popularity)]

app = FastAPI(title="BoardGameRecommender")

def number(value):
    return None if pd.isna(value) else round(float(value), 2)

def text(value):
    return value if isinstance(value, str) else None

def localized(game, column, lang):
    """The value for the local edition when BGG knows one, the original otherwise."""
    return text(game.get(f"{column}_{lang}")) or text(game.get(column))

def card(game_id, lang="en"):
    """What the interface shows about a game (NaN become null in the JSON)."""
    game = catalog.loc[game_id]
    return {
        "id": int(game_id),
        "name": localized(game, "name", lang),
        "original_name": game["name"],
        "year": number(game.yearpublished),
        "min_players": number(game.min_players),
        "max_players": number(game.max_players),
        "min_playtime": number(game.min_playtime),
        "max_playtime": number(game.max_playtime),
        "weight": number(game.weight),
        "rating": number(game.average),
        "mechanics": game.mechanics.split("|")[:3] if isinstance(game.mechanics, str) else [],
        "image": localized(game, "image", lang),
        "thumbnail": localized(game, "thumbnail", lang),
    }

class RecommendationRequest(BaseModel):
    ratings: dict[int, float] = {}  # game id -> rating from 1 to 10
    players: int | None = Field(None, ge=1)
    minutes: int | None = Field(None, ge=1)
    level: Literal[1, 2, 3] | None = None  # light, medium, heavy
    cooperative: bool | None = None
    offset: int = Field(0, ge=0)
    limit: int = Field(3, ge=1, le=50)
    lang: str = "en"

@app.get("/health")
def health():
    return {"status": "ok", "games": len(games), "languages": LANGUAGES}

@app.get("/search")
def search(q: str = Query(min_length=2), limit: int = Query(8, ge=1, le=50), lang: Language = "en"):
    """The best known games whose name, original or local, contains q."""
    found = catalog.name.str.contains(q, case=False, regex=False)
    if f"name_{lang}" in catalog:
        found |= catalog[f"name_{lang}"].str.contains(q, case=False, regex=False).fillna(False).astype(bool)
    return [card(game_id, lang) for game_id in catalog[found].nlargest(limit, "usersrated").index]

@app.get("/games")
def games_by_id(ids: list[int] = Query([]), lang: Language = "en"):
    """These games (those of the catalog), e.g. the ones a player rated before, in their language."""
    return [card(game_id, lang) for game_id in ids if game_id in catalog.index]

@app.get("/suggestions")
def suggest(exclude: list[int] = Query([]), limit: int = Query(6, ge=1, le=50), lang: Language = "en"):
    """Well-known games to rate, varied (strategy, family, party...), except those already rated or skipped."""
    found = suggestions(catalog, by_popularity, exclude)
    return [card(game_id, lang) for game_id, _ in zip(found, range(limit))]

@app.get("/bgg/{username}")
def bgg_ratings(username: str, lang: Language = "en"):
    """Ratings of a BGG user's collection, kept for the games of the catalog (BGG may take a few seconds to prepare it)."""
    url = f"https://boardgamegeek.com/xmlapi2/collection?username={quote(username)}&rated=1&stats=1&excludesubtype=boardgameexpansion"
    root = ET.fromstring(fetch(url).content)
    if root.tag == "errors" or root.find("error") is not None:
        raise HTTPException(404, "Unknown BGG username")
    ratings = {}
    for item in root.findall("item"):
        rating = item.find("stats/rating")
        try:
            ratings[int(item.get("objectid"))] = float(rating.get("value"))
        except (AttributeError, TypeError, ValueError):  # no rating ("N/A")
            continue
    known = [game_id for game_id in ratings if game_id in catalog.index]
    return {"total": len(ratings), "games": [{"game": card(game_id, lang), "rating": ratings[game_id]} for game_id in known]}

@app.post("/recommendations")
def recommendations(request: RecommendationRequest):
    ratings = {game_id: min(max(rating, 1), 10) for game_id, rating in request.ratings.items() if game_id in catalog.index}
    keep = matching(catalog, request.players, request.minutes, request.level, request.cooperative)
    ranked = recommend(ratings, model, keep)
    return {
        "total": len(ranked),
        "games": [card(game_id, request.lang) for game_id in ranked[request.offset:request.offset + request.limit]],
    }
