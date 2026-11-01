# BoardGameRecommender

🇬🇧 English | [🇫🇷 Français](README.fr.md)

Board game recommendation AI built on BoardGameGeek data.

## Structure

```
ETL/                          data pipeline (Python)
  Dockerfile
  bgg.py                      shared helpers (paths, API calls, CSV writes)
  10-get_bgg_games.py         downloads the BGG ranks dump and cleans it
  20-get_bgg_games_details.py adds each game's details (playtime, age, players, weight, mechanics, designers...)
  25-get_bgg_games_languages.py  adds each game's local title and box in French, German, Spanish and Italian (its editions)
  30-get_games_ratings.py     fetches ratings from the games' rating pages (20 games per request)
model/                        recommendation models and their evaluation (Python package)
  data.py                     loading of the ratings and the catalog, details of the games
  evaluation.py               cross-validated evaluation and comparison of the models on the same hidden ratings
  models/
    base.py                   base class of the models, and the popularity baseline
    ease.py                   EASE: linear model predicting each game from the other rated ones (closed form)
    recvae.py                 RecVAE: deep variational autoencoder (deep learning), one of the reranker's features
    lambdarank.py             best model: candidates (EASE mixed with popularity) described by EASE, RecVAE and content scores, reranked by a LightGBM ranker (optimizes NDCG)
  train.py                    trains the model of the interface on all the ratings and saves it (GPU: ~35 min)
  serving.py                  recommendations for a new player from the saved model, filtered by their answers
api/                          recommendation API used by the interface (Python, FastAPI)
  Dockerfile
  main.py                     search, suggestions to rate, import of BGG ratings, recommendations (model/serving.py)
web/                          interface (Next.js): games to answer one at a time, recommendations 3 at a time with filters
  lib/dictionaries/           texts of the interface, one file per language (en, fr, de, es, it)
  Dockerfile
data/raw/                     raw dump (not versioned)
data/processed/               prepared data (not versioned)
data/models/                  model saved by train.py, used by the API (not versioned)
```

## Configuration

```bash
cp .env.example .env
```

| Variable | Usage |
|---|---|
| `BGG_USERNAME`, `BGG_PASSWORD` | BGG account, to download the dump (script 10) |
| `BGC_BEARER_TOKEN` | BGG XML API token (scripts 20, 25 and 30, and the API to import a BGG user's ratings) |

## Fetching the data

Run the scripts in order, from the project root:

```bash
uv sync
uv run ETL/10-get_bgg_games.py
uv run ETL/20-get_bgg_games_details.py
uv run ETL/25-get_bgg_games_languages.py
uv run ETL/30-get_games_ratings.py
```

With Docker, `docker compose run --rm --build etl` runs the whole pipeline. For a single script:

```bash
docker compose run --rm etl uv run --no-sync ETL/10-get_bgg_games.py
```

Scripts 20, 25 and 30 write as they go and can be stopped and restarted: they only fetch what is missing.
To update with a new dump, rerun the whole pipeline: only the new games are queried.

| File (`data/processed/`) | Content |
|---|---|
| `boardgames_details.csv` | catalog: ranks from the latest dump + details; `mechanics`, `categories`, `designers` and `families` are lists of names separated by `\|`; `image` and `thumbnail` are the URLs of the game's picture on BGG |
| `games_ratings.csv` | `username`, `game_id`, `rating` (ratings from the games' pages) |
| `boardgames_languages.csv` | `id`, then `name_<lang>`, `image_<lang>`, `thumbnail_<lang>` for `fr`, `de`, `es`, `it`: title and box of the latest local editions (empty when BGG knows none) |
| `games_ratings_pages.csv` | `game_id`, `page` (rating pages already fetched) |

Temporary files: `boardgames_ranks_cleaned.csv` (between scripts 10 and 20) and `games_details.csv` (details fetched by script 20, kept only if it is interrupted), both deleted at the end of script 20.

## Recommending games

```bash
uv run python -m model.evaluation              # compare the models (5-fold cross-validation)
uv run python -m model.evaluation EASE RecVAE  # evaluate only some of them (Popularity, EASE, RecVAE, LambdaRank)
uv run python -m model.train                   # train the model of the interface (once)
```

New players (cold start): with few ratings, EASE alone does worse than simply proposing the most liked games.
With 1 or 2 ratings, the interface mixes EASE with the most liked games, trusting EASE more as the player rates more games
(weight k / (k + 120) after k ratings); from 3 ratings on, it uses LambdaRank.
Measured on 3000 players unseen by the models, share of the top 3 that the player liked:

| Ratings given | Most liked games | EASE | EASE + popularity mix | LambdaRank |
|---|---|---|---|---|
| 1 | 0.263 | 0.126 | **0.266** | 0.249 |
| 3 | 0.263 | 0.183 | 0.272 | **0.280** |
| 5 | 0.263 | 0.212 | 0.283 | **0.301** |
| 10 | 0.263 | 0.258 | 0.315 | **0.348** |
| 20 | 0.263 | 0.323 | 0.358 | **0.406** |
| 50 | 0.263 | 0.421 | 0.436 | **0.485** |

To serve new players, LambdaRank takes its 100 candidates from a mix of EASE and the most liked games (EASE weighs k / (k + 30)
after k ratings), and half of the players it learns from keep only 1 to 50 of their ratings. Compared with EASE candidates and
full profiles, this gains a lot with few ratings (0.348 instead of 0.312 at 10 ratings) for a small loss on known players
(NDCG 0.2540 instead of 0.2556 on one fold).

The models train on all the players, even those with a single rating, but are only evaluated on players with at least 10 ratings.

The deep learning models (including RecVAE, used by LambdaRank) train on the GPU when one is available, and are much slower without: on Windows, `uv sync` installs the CUDA build of PyTorch (the API Docker image uses the CPU build, enough to score players with a model trained beforehand).

## Web interface

The interface (`web/`, Next.js) only displays: it calls the API (`api/`, FastAPI), which computes the recommendations
(`model/serving.py`). The data must have been fetched (`data/processed/`) and the model trained (`uv run python -m model.train`) first.

With Docker, then open http://localhost:3000:

```bash
docker compose up --build
```

Without Docker, in two terminals:

```bash
uv run uvicorn api.main:app --reload             # API on http://localhost:8000 (docs: /docs)
cd web && npm install && npm run dev               # interface on http://localhost:3000
```

The player first chooses optional filters (players, duration, complexity, style), then answers about games one at a time (didn't like / it's OK / loved it, or never played), or searches for the ones
they played (or imports their BGG ratings instead), and gets the recommendations 3 at a time, with the filters still at hand and an "already played?" answer that refines them. The answers are kept in the browser (a reload or a change of
language loses nothing). Each answer becomes the mean BGG rating of its range (4.3 up to 5, 6.75 for 6-7, 8.6 from 8 on):
measured on new players, these 3 answers recommend as well as exact 1-10 ratings (top 3 at 10 answers: 0.347 vs 0.348),
whereas "liked" from 7 on does much worse (0.300), as 7 is a lukewarm rating on BGG.

The interface is in English, French, German, Spanish and Italian: `/` redirects to the language of the browser (English
otherwise), and the language menu changes it (remembered in a cookie). Games keep their BGG data, but show the title and box
of their local edition when there is one; the search also finds them by their local title.

The interface reaches the API through its own `/api/*` route; `API_URL` (default `http://localhost:8000`) sets where the API is.

## Metrics

Metrics (mean ± standard deviation over the folds, top 10 of each player):

| Metric | Meaning |
|---|---|
| `recall` | share of the hidden games the player liked (rating ≥ 8) found in the top 10 |
| `ndcg` | like recall, but a hit counts more near the top of the list (1 = perfect order) |
| `hit_rate` | share of players with at least one liked game in their top 10 |
| `novelty` | how little known the recommended games are (+1 = rated by half as many players) |
| `coverage` | share of the games recommended to at least one player |
| `diversity` | how different the games of a top 10 are from each other (distance between their details) |

NDCG is also given by number of ratings of the player (<50, 50-149, 150-399, 400+).
