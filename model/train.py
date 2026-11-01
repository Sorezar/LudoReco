"""Trains the model used by the API on all the ratings, and saves it in data/models/: uv run python -m model.train

About 35 minutes with a 5060 Mobile
"""
from .data import load_data
from .models.lambdarank import LambdaRank
from .serving import MODEL

if __name__ == "__main__":
    ratings, games = load_data()
    model = LambdaRank(ratings, games)
    MODEL.parent.mkdir(exist_ok=True)
    model.save(MODEL)
    print(f"Model saved in {MODEL}")
