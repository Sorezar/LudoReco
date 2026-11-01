"""LambdaRank: candidates (EASE mixed with popularity) reordered by a LightGBM ranker, which directly optimizes the order of each player's list (NDCG).

1. FirstStage: EASE, RecVAE and a content model pick CANDIDATES games per player and describe each of them (features)
2. the ranker learns from the training ratings themselves: part of them is hidden, and the examples are the candidates
   proposed without them, labelled 1 when the hidden ratings show the player liked the game. Half of the example players
   keep only a few ratings, so that the model also learns to serve new players.
"""
import warnings

import numpy as np
import pandas as pd
import torch
from lightgbm import LGBMRanker
from scipy.sparse import csr_matrix

from ..data import LIKED, game_features
from .base import Recommender
from .ease import EASE
from .recvae import RecVAE

CANDIDATES      = 100
CANDIDATE_MIX   = 30
TARGET_SHARE    = 0.2
TRAIN_USERS     = 20000
TRUNCATED_SHARE = 0.5
MAX_TRUNCATED   = 50
CHUNK           = 5000

GAME_COLUMNS = ["bayesaverage", "average", "usersrated", "weight", "yearpublished", "age", "min_playtime",
                "max_playtime", "min_players", "max_players", "best_min", "best_max"]
FEATURES = GAME_COLUMNS + ["candidate_score", "ease_score", "ease_rank", "vae_score", "content_score", "popularity",
                           "user_ratings", "user_mean", "user_liked_weight", "weight_gap"]

# A better score from the first-stage models can only increase the final score. Without these constraints
# the models learn noise such as "the 3rd candidate is better than the 1st" and do worse than the first stage alone.
MONOTONE = [{"candidate_score": 1, "ease_score": 1, "ease_rank": -1, "vae_score": 1, "content_score": 1}.get(feature, 0)
            for feature in FEATURES]

def standardize_rows(x):
    return (x - x.mean(1, keepdims=True)) / (x.std(1, keepdims=True) + 1e-9)

def truncate(R, rng):
    """Keeps 1 to MAX_TRUNCATED random ratings of TRUNCATED_SHARE of the players. Returns the kept and the removed ratings."""
    R = R.tocoo()
    keep_count = np.round(np.exp(rng.uniform(0, np.log(MAX_TRUNCATED), R.shape[0]))).astype(int)
    keep_count[rng.random(R.shape[0]) >= TRUNCATED_SHARE] = R.shape[1]
    # Ratings shuffled, then grouped by player: the first keep_count of each player are kept
    order = rng.permutation(R.nnz)
    order = order[np.argsort(R.row[order], kind="stable")]
    rows, cols, data = R.row[order], R.col[order], R.data[order]
    kept = np.arange(R.nnz) - np.searchsorted(rows, rows) < keep_count[rows]
    return (csr_matrix((data[kept], (rows[kept], cols[kept])), shape=R.shape),
            csr_matrix((data[~kept], (rows[~kept], cols[~kept])), shape=R.shape))

class FirstStage:
    """EASE, RecVAE and content models fitted on some ratings, giving candidates and features for any players."""

    def __init__(self, ratings, games):
        self.ease = EASE(ratings, games)
        self.vae = RecVAE(ratings, games)
        self.users, self.games = self.ease.users, self.ease.games
        self.matrix = self.ease.matrix
        self.features = game_features(games).loc[self.games].to_numpy()
        self.game_info = games.loc[self.games, GAME_COLUMNS].reset_index(drop=True)
        self.popularity = np.log(np.diff(self.matrix.tocsc().indptr))
        liked = np.log1p(ratings.game_id[ratings.rating >= LIKED].value_counts().reindex(self.games, fill_value=0).to_numpy())
        self.liked_popularity = (liked - liked.mean()) / liked.std()

    def candidates(self, R):
        rows = np.repeat(np.arange(R.shape[0]), np.diff(R.indptr))
        nb_ratings = np.diff(R.indptr)
        user_mean = np.bincount(rows, R.data, R.shape[0]) / np.maximum(nb_ratings, 1)
        weight = self.game_info.weight.to_numpy()
        liked = R.data >= LIKED
        liked_sums = np.bincount(rows[liked], weight[R.indices[liked]], R.shape[0])
        liked_counts = np.bincount(rows[liked], minlength=R.shape[0])
        user_liked_weight = np.divide(liked_sums, liked_counts, out=np.full(R.shape[0], np.nan), where=liked_counts > 0)

        # With few ratings EASE is unreliable: the candidates lean on the most liked games, less and less
        ease_scores = R @ self.ease.weights
        w = (nb_ratings / (nb_ratings + CANDIDATE_MIX))[:, None]
        candidate_scores = w * standardize_rows(ease_scores) + (1 - w) * self.liked_popularity
        candidate_scores[rows, R.indices] = -np.inf
        top = np.argpartition(-candidate_scores, CANDIDATES, axis=1)[:, :CANDIDATES]
        candidate_top = np.take_along_axis(candidate_scores, top, 1)
        ease_top = np.take_along_axis(ease_scores, top, 1)
        vae_top = np.take_along_axis(self.vae.profile_scores(R), top, 1)

        # Content scores: profile = ratings centered on the player mean @ game details
        centered = R.copy()
        centered.data = R.data - user_mean[rows]
        content_top = np.take_along_axis((centered @ self.features) @ self.features.T, top, 1)

        players, game_cols = np.repeat(np.arange(R.shape[0]), CANDIDATES), top.ravel()
        X = self.game_info.iloc[game_cols].reset_index(drop=True)
        X["candidate_score"]   = standardize_rows(candidate_top).ravel()
        X["ease_score"]        = standardize_rows(ease_top).ravel()
        X["ease_rank"]         = (-ease_top).argsort(1).argsort(1).ravel()
        X["vae_score"]         = standardize_rows(vae_top).ravel()
        X["content_score"]     = standardize_rows(content_top).ravel()
        X["popularity"]        = self.popularity[game_cols]
        X["user_ratings"]      = np.log(np.maximum(nb_ratings, 1))[players]
        X["user_mean"]         = user_mean[players]
        X["user_liked_weight"] = user_liked_weight[players]
        X["weight_gap"]        = X.weight - X.user_liked_weight

        return X, players, game_cols

class LambdaRank(Recommender):
    def __init__(self, ratings, games):
        super().__init__(ratings, games)

        hidden = np.random.default_rng(1).random(len(ratings)) < TARGET_SHARE
        target = ratings[hidden & (ratings.rating >= LIKED)]
        stage  = FirstStage(ratings[~hidden], games)
        rng    = np.random.default_rng(1)
        examples   = np.sort(rng.choice(len(stage.users), min(TRAIN_USERS, len(stage.users)), replace=False))
        R, removed = truncate(stage.matrix[examples], rng)

        players = pd.Index(stage.users[examples]).get_indexer(target.username)
        cols    = stage.games.get_indexer(target.game_id)
        known   = (players >= 0) & (cols >= 0)
        liked_removed = removed.multiply(removed >= LIKED).tocoo()
        T = csr_matrix((np.ones(known.sum() + liked_removed.nnz),
                        (np.concatenate([players[known], liked_removed.row]), np.concatenate([cols[known], liked_removed.col]))),
                       shape=R.shape)

        X, y = [], []
        for start in range(0, R.shape[0], CHUNK):
            X_chunk, players, game_cols = stage.candidates(R[start:start + CHUNK])
            X.append(X_chunk[FEATURES])
            y.append(np.asarray(T[players + start, game_cols]).ravel() > 0)
        self.fit(pd.concat(X, ignore_index=True), np.concatenate(y))
        del stage, X

        self.stage = FirstStage(ratings, games)

    def fit(self, X, y):
        self.ranker = LGBMRanker(
            objective            = "lambdarank",
            n_estimators         = 300,
            learning_rate        = 0.03,
            num_leaves           = 15,
            min_child_samples    = 300,
            random_state         = 0,
            verbose              = -1,
            monotone_constraints = MONOTONE
        )
        self.ranker.fit(X, y.astype(int), group=[CANDIDATES] * (len(X) // CANDIDATES))

    def predict(self, X):
        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            return self.ranker.predict(X)

    def profile_scores(self, R):
        """Scores of every game for players given by their ratings (sparse, columns = self.games), -inf if not a candidate."""
        X, players, game_cols = self.stage.candidates(R)
        scores = np.full(R.shape, -np.inf)
        scores[players, game_cols] = self.predict(X[FEATURES])
        return scores

    def scores(self, row):
        return self.profile_scores(self.matrix[[row]])[0]

    def save(self, path):
        """Saves the model to score new players (the training ratings are dropped: players of the data cannot be scored any more)."""
        self.stage.vae.vae.cpu()
        self.stage.ease.weights = self.stage.ease.weights.astype(np.float32)  # half the size, same recommendations
        for model in [self, self.stage, self.stage.ease, self.stage.vae]:
            model.matrix = None
        torch.save(self, path)

    @staticmethod
    def load(path):
        return torch.load(path, map_location="cpu", weights_only=False)
