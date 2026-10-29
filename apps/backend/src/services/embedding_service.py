"""Text embeddings behind one shared interface.

`EmbeddingService.embed()` is the single seam shared by ingestion (the seed
script) and retrieval (the query path): both must embed with the SAME provider
and model so vectors are comparable. The model loads once per process.

Two providers, selected by `settings.EMBEDDING_PROVIDER`:

- "sentence_transformers" (default): a self-hosted open model (bge-large-en-v1.5,
  1024-dim). Installs and runs natively on arm64 / Python 3.13 — no emulation.
- "sonar": Meta's SONAR text encoder. Faithful Meta model, but fairseq2n ships
  no cp313 or linux-arm64 wheel, and it pins huggingface-hub<1.0 (incompatible
  with the base deps), so it is NOT a project extra: install it out-of-band on an
  x86_64, Python<=3.12 host with `uv pip install "sonar-space==0.5.0"` (see the
  note in pyproject [project.optional-dependencies]).

Both providers are synchronous, CPU/GPU-bound PyTorch, so `embed()` offloads to a
worker thread to keep the FastAPI event loop free. The heavy model imports are
deferred to first use, so importing this module stays cheap and needs neither
backend installed until embeddings are actually computed.
"""
from __future__ import annotations

from typing import Any

import anyio

from src.config import settings


class EmbeddingService:
    """Turns text into vectors via the configured provider; model is a process singleton."""

    _backend: Any = None

    def _load(self) -> Any:
        if EmbeddingService._backend is None:
            provider = settings.EMBEDDING_PROVIDER
            if provider == "sentence_transformers":
                # Deferred import: only needed when we actually embed.
                from sentence_transformers import SentenceTransformer

                EmbeddingService._backend = SentenceTransformer(settings.ST_MODEL)
            elif provider == "sonar":
                from sonar.inference_pipelines.text import TextToEmbeddingModelPipeline

                EmbeddingService._backend = TextToEmbeddingModelPipeline(
                    encoder=settings.SONAR_ENCODER,
                    tokenizer=settings.SONAR_ENCODER,
                )
            else:
                raise ValueError(
                    f"Unknown EMBEDDING_PROVIDER {provider!r}; "
                    "expected 'sentence_transformers' or 'sonar'."
                )
        return EmbeddingService._backend

    def _embed_sync(self, texts: list[str]) -> list[list[float]]:
        model = self._load()
        if settings.EMBEDDING_PROVIDER == "sentence_transformers":
            # Normalize so cosine distance stays well-conditioned in pgvector.
            vectors = model.encode(texts, normalize_embeddings=True).tolist()
        else:
            vectors = model.predict(texts, source_lang=settings.SONAR_SOURCE_LANG).cpu().tolist()

        # Fail loud if the model's width doesn't match the DB column; a silent
        # mismatch would otherwise surface only as an opaque insert error later.
        if vectors and len(vectors[0]) != settings.EMBEDDING_DIM:
            raise ValueError(
                f"Embedding width {len(vectors[0])} != EMBEDDING_DIM "
                f"{settings.EMBEDDING_DIM}. Align ST_MODEL/EMBEDDING_DIM (and the "
                "card_chunks Vector size) so they match."
            )
        return vectors

    async def embed(self, texts: list[str]) -> list[list[float]]:
        """Embed a batch of texts → one EMBEDDING_DIM-sized vector each.

        Runs the blocking forward pass in a worker thread so callers on the async
        event loop (API handlers, the seed script) are not blocked.
        """
        if not texts:
            return []
        return await anyio.to_thread.run_sync(self._embed_sync, list(texts))


# Import this singleton everywhere; the model loads once on first embed().
embedding_service = EmbeddingService()
