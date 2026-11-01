# BoardGameRecommender

[🇬🇧 English](README.md) | 🇫🇷 Français

IA de recommandation de jeux de société à partir des données BoardGameGeek.

## Structure

```
ETL/                          chaîne de données (Python)
  Dockerfile
  bgg.py                      outils communs (chemins, appels API, écriture CSV)
  10-get_bgg_games.py         télécharge le dump des classements BGG et le nettoie
  20-get_bgg_games_details.py ajoute les détails de chaque jeu (durée, âge, joueurs, poids, mécaniques, auteurs...)
  25-get_bgg_games_languages.py  ajoute le titre et la boîte de chaque jeu en français, allemand, espagnol et italien (ses éditions)
  30-get_games_ratings.py     récupère les notes depuis les pages des jeux (20 jeux par requête)
model/                        modèles de recommandation et leur évaluation (paquet Python)
  data.py                     chargement des notes et du catalogue, détails des jeux
  evaluation.py               évaluation croisée et comparaison des modèles sur les mêmes notes cachées
  models/
    base.py                   classe de base des modèles, et la référence par popularité
    ease.py                   EASE : modèle linéaire qui prédit chaque jeu à partir des autres jeux notés (solution exacte)
    recvae.py                 RecVAE : auto-encodeur variationnel profond (deep learning), une des entrées du reclassement
    lambdarank.py             meilleur modèle : candidats (EASE mélangé à la popularité) décrits par les scores EASE, RecVAE et contenu, reclassés par un ranker LightGBM (optimise le NDCG)
  train.py                    entraîne le modèle de l'interface sur toutes les notes et l'enregistre (GPU : ~35 min)
  serving.py                  recommandations pour un nouveau joueur à partir du modèle enregistré, filtrées par ses réponses
api/                          API de recommandation utilisée par l'interface (Python, FastAPI)
  Dockerfile
  main.py                     recherche, suggestions à noter, import des notes BGG, recommandations (model/serving.py)
web/                          interface (Next.js) : avis sur les jeux un par un, recommandations 3 par 3 avec filtres
  lib/dictionaries/           textes de l'interface, un fichier par langue (en, fr, de, es, it)
  Dockerfile
data/raw/                     dump brut (non versionné)
data/processed/               données préparées (non versionnées)
data/models/                  modèle enregistré par train.py, utilisé par l'API (non versionné)
```

## Configuration

```bash
cp .env.example .env
```

| Variable | Usage |
|---|---|
| `BGG_USERNAME`, `BGG_PASSWORD` | compte BGG, pour télécharger le dump (script 10) |
| `BGC_BEARER_TOKEN` | token de l'API XML de BGG (scripts 20, 25 et 30, et l'API pour importer les notes d'un utilisateur BGG) |

## Récupérer les données

Lancer les scripts dans l'ordre, depuis la racine :

```bash
uv sync
uv run ETL/10-get_bgg_games.py
uv run ETL/20-get_bgg_games_details.py
uv run ETL/25-get_bgg_games_languages.py
uv run ETL/30-get_games_ratings.py
```

Avec Docker, `docker compose run --rm --build etl` lance toute la chaîne. Pour un seul script :

```bash
docker compose run --rm etl uv run --no-sync ETL/10-get_bgg_games.py
```

Les scripts 20, 25 et 30 écrivent au fur et à mesure et peuvent être interrompus puis relancés : ils ne récupèrent que ce qui manque.
Pour mettre à jour avec un nouveau dump, relancer toute la chaîne : seuls les nouveaux jeux sont interrogés.

| Fichier (`data/processed/`) | Contenu |
|---|---|
| `boardgames_details.csv` | catalogue : classements du dernier dump + détails ; `mechanics`, `categories`, `designers` et `families` sont des listes de noms séparés par `\|` ; `image` et `thumbnail` sont les adresses de l'image du jeu sur BGG |
| `games_ratings.csv` | `username`, `game_id`, `rating` (notes issues des pages des jeux) |
| `boardgames_languages.csv` | `id`, puis `name_<langue>`, `image_<langue>`, `thumbnail_<langue>` pour `fr`, `de`, `es`, `it` : titre et boîte des dernières éditions locales (vides si BGG n'en connaît pas) |
| `games_ratings_pages.csv` | `game_id`, `page` (pages de notes déjà récupérées) |

Fichiers temporaires : `boardgames_ranks_cleaned.csv` (entre les scripts 10 et 20) et `games_details.csv` (détails récupérés par le script 20, conservé seulement s'il est interrompu), tous deux supprimés à la fin du 20.

## Recommander des jeux

```bash
uv run python -m model.evaluation              # compare les modèles (validation croisée en 5 parties)
uv run python -m model.evaluation EASE RecVAE  # n'en évalue que certains (Popularity, EASE, RecVAE, LambdaRank)
uv run python -m model.train                   # entraîne le modèle de l'interface (une fois)
```

Nouveaux joueurs (démarrage à froid) : avec peu de notes, EASE seul fait moins bien que proposer simplement les jeux les plus aimés.
Avec 1 ou 2 notes, l'interface mélange EASE et les jeux les plus aimés, en faisant de plus en plus confiance à EASE à mesure que le joueur note des jeux
(poids k / (k + 120) après k notes) ; à partir de 3 notes, elle utilise LambdaRank.
Mesuré sur 3000 joueurs que les modèles n'ont jamais vus, part du top 3 que le joueur a aimée :

| Notes données | Jeux les plus aimés | EASE | Mélange EASE + popularité | LambdaRank |
|---|---|---|---|---|
| 1 | 0,263 | 0,126 | **0,266** | 0,249 |
| 3 | 0,263 | 0,183 | 0,272 | **0,280** |
| 5 | 0,263 | 0,212 | 0,283 | **0,301** |
| 10 | 0,263 | 0,258 | 0,315 | **0,348** |
| 20 | 0,263 | 0,323 | 0,358 | **0,406** |
| 50 | 0,263 | 0,421 | 0,436 | **0,485** |

Pour servir les nouveaux joueurs, LambdaRank prend ses 100 candidats dans un mélange d'EASE et des jeux les plus aimés (poids d'EASE
k / (k + 30) après k notes), et la moitié des joueurs dont il apprend ne garde que 1 à 50 de ses notes. Par rapport aux candidats EASE
et aux profils complets, on gagne beaucoup avec peu de notes (0,348 au lieu de 0,312 à 10 notes) pour une petite perte sur les joueurs
connus (NDCG 0,2540 au lieu de 0,2556 sur une part).

Les modèles s'entraînent sur tous les joueurs, même ceux qui n'ont qu'une note, mais ne sont évalués que sur les joueurs ayant au moins 10 notes.

Les modèles de deep learning (dont RecVAE, utilisé par LambdaRank) s'entraînent sur le GPU s'il y en a un, et sont beaucoup plus lents sans : sous Windows, `uv sync` installe la version CUDA de PyTorch (l'image Docker de l'API utilise la version CPU, suffisante pour noter les joueurs avec un modèle entraîné avant).

## Interface web

L'interface (`web/`, Next.js) ne fait qu'afficher : elle appelle l'API (`api/`, FastAPI), qui calcule les recommandations
(`model/serving.py`). Les données doivent avoir été récupérées (`data/processed/`) et le modèle entraîné (`uv run python -m model.train`) avant.

Avec Docker, puis ouvrir http://localhost:3000 :

```bash
docker compose up --build
```

Sans Docker, dans deux terminaux :

```bash
uv run uvicorn api.main:app --reload             # API sur http://localhost:8000 (documentation : /docs)
cd web && npm install && npm run dev               # interface sur http://localhost:3000
```

Le joueur choisit d'abord des filtres facultatifs (joueurs, durée, complexité, style), puis donne son avis sur des jeux un par un (pas aimé / sympa / adoré, ou jamais joué), ou cherche ceux auxquels il a
joué (ou importe plutôt ses notes BGG), et reçoit les recommandations 3 par 3, avec les filtres toujours modifiables et un « déjà joué ? » qui les affine. Les réponses sont gardées dans le navigateur (un rechargement ou un changement de
langue ne fait rien perdre). Chaque réponse devient la note BGG moyenne de sa tranche (4,3 jusqu'à 5, 6,75 pour 6-7, 8,6 à
partir de 8) : mesuré sur de nouveaux joueurs, ces 3 réponses recommandent aussi bien que des notes exactes de 1 à 10 (top 3
à 10 réponses : 0,347 contre 0,348), alors que « aimé » dès 7 fait nettement moins bien (0,300), 7 étant une note tiède sur BGG.

L'interface est en anglais, français, allemand, espagnol et italien : `/` redirige vers la langue du navigateur (l'anglais
sinon), et le menu des langues permet d'en changer (choix gardé dans un cookie). Les jeux gardent leurs données BGG, mais
affichent le titre et la boîte de leur édition locale quand il y en a une ; la recherche les trouve aussi par leur titre local.

L'interface joint l'API par sa propre route `/api/*` ; `API_URL` (par défaut `http://localhost:8000`) indique où se trouve l'API.

## Métriques

Métriques (moyenne ± écart-type sur les découpages, top 10 de chaque joueur) :

| Métrique | Signification |
|---|---|
| `recall` | part des jeux cachés que le joueur a aimés (note ≥ 8) retrouvés dans le top 10 |
| `ndcg` | comme le recall, mais un jeu trouvé compte plus s'il est en haut de la liste (1 = ordre parfait) |
| `hit_rate` | part des joueurs avec au moins un jeu aimé dans leur top 10 |
| `novelty` | à quel point les jeux recommandés sont peu connus (+1 = notés par deux fois moins de joueurs) |
| `coverage` | part des jeux recommandés à au moins un joueur |
| `diversity` | à quel point les jeux d'un top 10 diffèrent entre eux (distance entre leurs détails) |

Le NDCG est aussi donné par nombre de notes du joueur (<50, 50-149, 150-399, 400+).
