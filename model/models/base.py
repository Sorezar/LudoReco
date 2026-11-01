"""Base class of the recommenders, and the simplest of them."""
import numpy as np
import pandas as pd
from scipy.sparse import csr_matrix

N = 10  # number of recommendations

class Recommender:
    """Indexes players and games, and turns per-game scores into recommendations."""

    def __init__(self, ratings, games):
        self.users = pd.Index(ratings.username.unique())
        self.games = pd.Index(ratings.game_id.unique())
        self.matrix = csr_matrix(
            (ratings.rating.astype(float), (self.users.get_indexer(ratings.username), self.games.get_indexer(ratings.game_id))),
            shape=(len(self.users), len(self.games))
        )

    def scores(self, row):
        raise NotImplementedError

    def recommend(self, username, n=N):
        row = self.users.get_loc(username)
        scores = self.scores(row).astype(float)
        scores[self.matrix[row].indices] = -np.inf  # never recommend a game already rated
        return self.games[np.argsort(-scores)[:n]].tolist()

class Popularity(Recommender):
    """Baseline: the most rated games, same for everyone."""

    def __init__(self, ratings, games):
        super().__init__(ratings, games)
        self.counts = np.diff(self.matrix.tocsc().indptr)

    def scores(self, row):
        return self.counts
