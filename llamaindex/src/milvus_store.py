"""Milvus vector store helper functions."""

import asyncio
from typing import Any

from llama_index.vector_stores.milvus import MilvusVectorStore


def create_milvus_vector_store(**kwargs: Any) -> MilvusVectorStore:
    """Create MilvusVectorStore in a sync-safe way for pymilvus async init."""
    try:
        asyncio.get_running_loop()
    except RuntimeError:
        async def _build() -> MilvusVectorStore:
            return MilvusVectorStore(**kwargs)

        return asyncio.run(_build())

    return MilvusVectorStore(**kwargs)
