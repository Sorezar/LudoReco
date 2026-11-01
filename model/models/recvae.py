"""RecVAE (Shenbin et al., 2020): variational autoencoder that rebuilds the games a player liked from a compressed
version of them (Mult-VAE, Liang et al., 2018), with a deeper encoder and a training that keeps it stable.

- the encoder has 5 layers, each one receiving the sum of the previous ones (dense connections);
- the prior mixes a standard normal, a very wide normal and the encoder of the previous epoch (composite prior),
  so the encoder cannot drift away from what the decoder learned;
- the weight of the KL term grows with the number of liked games of the player (GAMMA);
- each epoch trains the encoder (with dropout) then the decoder (without), alternately.
The input only keeps the liked games (better than the raw ratings).
"""
import copy
import math

import numpy as np
import torch
from torch import nn

from ..data import LIKED
from .base import Recommender

HIDDEN         = 600
LATENT         = 200
LAYERS         = 5
DROPOUT        = 0.5
EPOCHS         = 20
ENCODER_EPOCHS = 3     
BATCH_SIZE     = 500
LEARNING_RATE  = 5e-4
GAMMA          = 0.005       
PRIOR_WEIGHTS = [3 / 20, 15 / 20, 2 / 20]  # standard normal, previous encoder, wide normal
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"

def liked(R, device=DEVICE):
    x = torch.zeros(R.shape, device=device)
    x[np.repeat(np.arange(R.shape[0]), np.diff(R.indptr)), R.indices] = torch.from_numpy((R.data >= LIKED).astype(np.float32)).to(device)
    return x

def log_normal(z, mu, logvar):
    return -0.5 * (logvar + math.log(2 * math.pi) + (z - mu) ** 2 / logvar.exp())

class Encoder(nn.Module):

    def __init__(self, n_games):
        super().__init__()
        self.layers = nn.ModuleList(nn.Linear(n_games if i == 0 else HIDDEN, HIDDEN) for i in range(LAYERS))
        self.norms = nn.ModuleList(nn.LayerNorm(HIDDEN) for _ in range(LAYERS))
        self.mu, self.logvar = nn.Linear(HIDDEN, LATENT), nn.Linear(HIDDEN, LATENT)

    def forward(self, x, dropout=0.0):
        x = nn.functional.dropout(nn.functional.normalize(x), dropout, self.training)
        h, total = x, 0
        for layer, norm in zip(self.layers, self.norms):
            h = norm(nn.functional.silu(layer(h)) + total)
            total = total + h
        return self.mu(h), self.logvar(h)

class VAE(nn.Module):

    def __init__(self, n_games):
        super().__init__()
        self.encoder = Encoder(n_games)
        self.old_encoder = copy.deepcopy(self.encoder).requires_grad_(False)
        self.decoder = nn.Linear(LATENT, n_games)

    def prior(self, x, z):
        mu, logvar = self.old_encoder(x)
        zeros = torch.zeros_like(z)
        densities = [log_normal(z, zeros, zeros), log_normal(z, mu, logvar), log_normal(z, zeros, zeros + 10)]
        return torch.logsumexp(torch.stack([d + math.log(w) for d, w in zip(densities, PRIOR_WEIGHTS)]), 0)

    def loss(self, x, dropout):
        mu, logvar = self.encoder(x, dropout)
        z = mu + torch.randn_like(mu) * torch.exp(0.5 * logvar)
        likelihood = (nn.functional.log_softmax(self.decoder(z), 1) * x).sum(1)
        kl = (log_normal(z, mu, logvar) - self.prior(x, z)).sum(1) * GAMMA * x.sum(1)
        return (kl - likelihood).mean()

class RecVAE(Recommender):

    def __init__(self, ratings, games, epochs=EPOCHS):
        super().__init__(ratings, games)
        torch.manual_seed(0)
        self.vae = VAE(len(self.games)).to(DEVICE)
        encoder_optimizer = torch.optim.Adam(self.vae.encoder.parameters(), lr=LEARNING_RATE)
        decoder_optimizer = torch.optim.Adam(self.vae.decoder.parameters(), lr=LEARNING_RATE)
        rng = np.random.default_rng(0)

        self.vae.train()
        for _ in range(epochs):
            for optimizer, passes, dropout in [(encoder_optimizer, ENCODER_EPOCHS, DROPOUT), (decoder_optimizer, 1, 0.0)]:
                for _ in range(passes):
                    for rows in np.array_split(rng.permutation(len(self.users)), max(1, len(self.users) // BATCH_SIZE)):
                        loss = self.vae.loss(self.batch(rows), dropout)
                        optimizer.zero_grad()
                        loss.backward()
                        optimizer.step()
                if optimizer is encoder_optimizer:
                    self.vae.old_encoder.load_state_dict(self.vae.encoder.state_dict())
        self.vae.eval()

    def batch(self, rows):
        return liked(self.matrix[rows])

    @torch.no_grad()
    def profile_scores(self, R):
        mu, _ = self.vae.encoder(liked(R, next(self.vae.parameters()).device))  # device of the model, even once saved
        return self.vae.decoder(mu).cpu().numpy()

    def scores(self, row):
        return self.profile_scores(self.matrix[[row]])[0]
