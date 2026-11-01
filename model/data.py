"""Ratings and catalog prepared by the ETL, as used by the models."""
from pathlib import Path

import numpy as np
import pandas as pd

PROCESSED_DIR = Path(__file__).parent.parent / "data" / "processed"

MIN_GAME_RATINGS = 10  # games with fewer ratings in our data are ignored
MIN_USER_RATINGS = 10  # only the players with this many ratings are evaluated
MIN_TRAIN_RATINGS = 1  # players with fewer ratings are not used for training either
LIKED = 8              # a rating from this value on means the player liked the game

def load_data(min_train_ratings=MIN_TRAIN_RATINGS):
    games = pd.read_csv(PROCESSED_DIR / "boardgames_details.csv").set_index("id")
    dtypes = {"username": str, "game_id": "int32", "rating": "float32"}
    ratings = pd.read_csv(PROCESSED_DIR / "games_ratings.csv", keep_default_na=False, dtype=dtypes)
    ratings = ratings[ratings.game_id.isin(games.index)].drop_duplicates(["username", "game_id"])
    game_counts = ratings.game_id.value_counts()
    ratings = ratings[ratings.game_id.isin(game_counts[game_counts >= MIN_GAME_RATINGS].index)]
    user_counts = ratings.username.map(ratings.username.value_counts())
    # The players who can be evaluated come first: the folds are drawn in this order, so adding the other
    # players afterwards does not change how the ratings of the evaluated ones are split
    evaluated = user_counts >= MIN_USER_RATINGS
    ratings = pd.concat([ratings[evaluated], ratings[~evaluated & (user_counts >= min_train_ratings)]])
    return ratings, games

def game_features(games):
    """Standardized details of each game (complexity, duration, players, age, year, categories)."""
    features = games[["weight", "age", "min_players", "max_players", "best_min", "best_max", "yearpublished"]].copy()
    features["min_playtime"] = np.log1p(games.min_playtime)
    features["max_playtime"] = np.log1p(games.max_playtime)
    features = features.join(games.filter(regex="^is_"))
    features = features.fillna(features.median())
    return ((features - features.mean()) / features.std()).clip(-3, 3)
