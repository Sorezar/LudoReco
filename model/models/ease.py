"""EASE (Steck, 2019)"""
import numpy as np

from .base import Recommender

REG = 15000.0  # regularization of the weights (best NDCG with the full data; X holds ratings 1-10, hence the large value)

class EASE(Recommender):

    def __init__(self, ratings, games, reg=REG):
        super().__init__(ratings, games)
        X = self.matrix
        P = np.linalg.inv((X.T @ X).toarray() + reg * np.eye(X.shape[1]))
        self.weights = -P / np.diag(P)
        np.fill_diagonal(self.weights, 0)

    def scores(self, row):
        return (self.matrix[row] @ self.weights).ravel()
