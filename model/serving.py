"""Recommendations for a new player, from the model trained by train.py (used by the API).

With few ratings, EASE is mixed with the most liked games (EASE alone is worse than popularity, so it is trusted more
as the player rates more games: k / (k + MIX)); from LAMBDARANK_FROM ratings on, LambdaRank does better and is used.
The games are then filtered by the player's answers (players, duration, complexity, cooperative or not).
"""
from itertools import zip_longest

import numpy as np
import pandas as pd
from scipy.sparse import csr_matrix

from .data import PROCESSED_DIR
from .models.lambdarank import LambdaRank

MODEL = PROCESSED_DIR.parent / "models" / "lambdarank.pt"
MIX   = 120            # weight of EASE after k ratings: k / (k + MIX), tuned on players unseen by the model
LAMBDARANK_FROM = 3  # LambdaRank beats the mix from about 3 ratings on (players unseen by the model)
WEIGHT_LEVELS = {1: (0, 2), 2: (2, 3), 3: (3, 6)}  # light, medium, heavy (BGG weight from 1 to 5)
# BGG domains the suggestions alternate between (children's, card and war games are too niche to be known)
DOMAINS = ["is_strategygames", "is_familygames", "is_partygames", "is_thematic", "is_abstracts"]

def standardize(x):
    return (x - x.mean()) / (x.std() + 1e-9)

def load_model():
    if not MODEL.exists():
        raise SystemExit("No trained model: run `uv run python -m model.train` first (about 35 minutes with a GPU).")
    return LambdaRank.load(MODEL)

def matching(catalog, players=None, minutes=None, level=None, cooperative=None):
    """Boolean mask of the games that match the player's answers (None = no preference)."""
    keep = pd.Series(True, index=catalog.index)
    if players:
        keep &= (catalog.min_players <= players) & (catalog.max_players >= players)
    if minutes:
        keep &= catalog.min_playtime <= minutes
    if level:
        low, high = WEIGHT_LEVELS[int(level)]
        keep &= (catalog.weight >= low) & (catalog.weight < high)
    if cooperative is not None:
        keep &= catalog.mechanics.fillna("").str.contains("Cooperative Game") == cooperative
    return keep.to_numpy()

def suggestions(catalog, order, exclude=()):
    """Popular games, alternating between the BGG domains (family, strategy, party...) to learn a varied taste quickly."""
    queues = [[game_id for game_id in order if catalog.at[game_id, domain]] for domain in DOMAINS]
    seen = set(exclude)
    for game_id in (g for round_ in zip_longest(*queues) for g in round_ if g is not None):
        if game_id not in seen:
            seen.add(game_id)
            yield game_id

def recommend(rated, model, keep):
    """Game ids from the best to the worst for this player, among the games that match their answers (keep)."""
    games = model.games
    columns = games.get_indexer(list(rated))
    R = csr_matrix((list(rated.values()), (np.zeros(len(rated), dtype=int), columns)), shape=(1, len(games)))
    popularity = model.stage.liked_popularity
    w = len(rated) / (len(rated) + MIX)
    scores = w * standardize(np.asarray(R @ model.stage.ease.weights).ravel()) + (1 - w) * popularity if rated else popularity
    order = np.argsort(-scores)
    if len(rated) >= LAMBDARANK_FROM:
        # LambdaRank only orders its candidates: the other games follow, in the order of the mix
        reranked = model.profile_scores(R)[0]
        candidates = np.flatnonzero(np.isfinite(reranked))
        order = np.concatenate([candidates[np.argsort(-reranked[candidates])], order[~np.isin(order, candidates)]])
    order = order[keep[order] & ~np.isin(order, columns)]
    return games[order]
