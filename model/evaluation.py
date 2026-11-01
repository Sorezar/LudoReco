"""Evaluates the recommenders on the same cross-validation folds.

uv run python -m model.evaluation               # every model
uv run python -m model.evaluation EASE RecVAE   # only these ones
"""
import sys

import numpy as np
import pandas as pd

from .data import LIKED, MIN_USER_RATINGS, game_features, load_data
from .models.base import N, Popularity
from .models.ease import EASE
from .models.lambdarank import LambdaRank
from .models.recvae import RecVAE

FOLDS          = 5                  # number of cross-validation folds
EVAL_USERS     = 5000               # players evaluated per fold (all the players are still used for training)
SEGMENTS       = [0, 50, 150, 400] 
SEGMENT_LABELS = ["<50", "50-149", "150-399", "400+"]
MODELS         = {model.__name__: model for model in [Popularity, EASE, RecVAE, LambdaRank]}
DEFAULT        = ["Popularity", "EASE", "LambdaRank"]
METRICS        = ["recall", "ndcg", "hit_rate", "novelty", "coverage", "diversity"]

def folds(ratings):
    """Cross-validation: every rating is hidden exactly once, in one of the FOLDS (always the same split)."""
    fold = np.random.default_rng(0).integers(0, FOLDS, len(ratings))
    for f in range(FOLDS):
        yield ratings[fold != f], ratings[fold == f]

def ranking_metrics(recommended, liked, n=N):
    """Accuracy of one player's top n against the hidden games they liked."""
    hits = np.array([game in liked for game in recommended])
    discounts = 1 / np.log2(np.arange(2, n + 2))  # a hit counts less the lower it is in the list
    return {
        "recall": hits.sum() / min(n, len(liked)),
        "ndcg": (hits * discounts).sum() / discounts[:min(n, len(liked))].sum(),
        "hit_rate": float(hits.any()),
    }

def metrics(model, train, test, features, n=N):
    """Scores the top n of EVAL_USERS players (always the same ones, with at least MIN_USER_RATINGS ratings)
    who liked at least one hidden game.

    recall    share of the hidden liked games found in the top n
    ndcg      like recall, but a hit counts more when it is near the top of the list (1 = perfect order)
    hit_rate  share of players with at least one hidden liked game in their top n
    novelty   mean -log2(share of players who rated the game): +1 = recommended games rated by half as many players
    coverage  share of the games recommended to at least one player
    diversity mean distance (1 - cosine of the details) between two games of the same top n
    ndcg <x>  ndcg of the players with x ratings
    """
    liked = test[(test.rating >= LIKED) & test.game_id.isin(model.games) & test.username.isin(model.users)]
    nb_ratings = train.username.value_counts().add(test.username.value_counts(), fill_value=0)
    liked = liked[liked.username.map(nb_ratings) >= MIN_USER_RATINGS]
    players = np.sort(liked.username.unique())
    players = np.random.default_rng(0).choice(players, min(EVAL_USERS, len(players)), replace=False)
    liked = liked[liked.username.isin(players)].groupby("username").game_id.apply(set)
    recommendations = {u: model.recommend(u, n) for u in liked.index}
    recommended = np.concatenate(list(recommendations.values()))
    per_player = pd.DataFrame([ranking_metrics(recommendations[u], games, n) for u, games in liked.items()], index=liked.index)

    popularity = train.game_id.value_counts() / train.username.nunique()
    normalized = features / np.linalg.norm(features, axis=1, keepdims=True)
    similarity = [normalized.loc[games].to_numpy() @ normalized.loc[games].to_numpy().T for games in recommendations.values()]

    results = {
        **per_player.mean(),
        "novelty": np.mean(-np.log2(popularity[recommended])),
        "coverage": len(set(recommended)) / len(model.games),
        "diversity": np.mean([1 - (s.sum() - n) / (n * (n - 1)) for s in similarity]),
    }

    nb_ratings = train.groupby("username").size()[liked.index]
    segments = pd.cut(nb_ratings, SEGMENTS + [np.inf], right=False, labels=SEGMENT_LABELS)
    for label, ndcg in per_player.ndcg.groupby(segments, observed=False).mean().items():
        results[f"ndcg {label}"] = ndcg
    return results

def evaluate(model_class, ratings, games, n=N):
    """Mean and standard deviation of the metrics over the folds."""
    features = game_features(games)
    results = pd.DataFrame([metrics(model_class(train, games), train, test, features, n) for train, test in folds(ratings)])
    return results.mean(), results.std()

def print_header(columns):
    print(f"\n{'model':<18}" + "".join(f"{column:>16}" for column in columns))

def print_row(name, mean, std, columns):
    print(f"{name:<18}" + "".join(f"{f'{mean[c]:.3f} ± {std[c]:.3f}':>16}" for c in columns), flush=True)

if __name__ == "__main__":
    names = sys.argv[1:] or DEFAULT
    if unknown := [name for name in names if name not in MODELS]:
        raise SystemExit(f"Unknown model(s): {', '.join(unknown)}. Available: {', '.join(MODELS)}")
    ratings, games = load_data()
    results = {}
    print_header(METRICS)
    for name in names:
        # Each row is printed as soon as its model is evaluated
        results[name] = evaluate(MODELS[name], ratings, games)
        print_row(name, *results[name], METRICS)

    print("\nNDCG by number of ratings of the player:", end="")
    segments = [f"ndcg {label}" for label in SEGMENT_LABELS]
    print_header(segments)
    for name, (mean, std) in results.items():
        print_row(name, mean, std, segments)
