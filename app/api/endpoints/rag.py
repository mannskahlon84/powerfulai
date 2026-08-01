from typing import List, Optional
from pydantic import BaseModel
from fastapi import APIRouter, HTTPException, Query
from app.core.schemas import PolicyDocument
from app.rag.pipeline import rag_pipeline

router = APIRouter(prefix="/rag", tags=["RAG Knowledge Base & Qatar Labour Law"])


class SearchRequest(BaseModel):
    query: str
    top_k: int = 3
    category: Optional[str] = None


@router.get("/policies", response_model=List[PolicyDocument], summary="List All Indexed HR Policies")
async def list_indexed_policies():
    """
    Returns all indexed Qatar Labour Law and HR policy document sections from the RAG knowledge base.
    """
    try:
        return rag_pipeline.documents
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/search", response_model=List[PolicyDocument], summary="Semantic Vector Search")
async def search_policies(request: SearchRequest):
    """
    Execute semantic similarity search over Qatar Labour Law policy documents.
    """
    try:
        results = rag_pipeline.search_policy(
            query=request.query,
            top_k=request.top_k,
            category=request.category
        )
        return results
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/reindex", summary="Reindex Policy Documents")
async def reindex_policies():
    """
    Reload and re-index all Markdown files from /app/rag/policy_docs.
    """
    try:
        rag_pipeline.ingest_policies()
        return {
            "success": True,
            "indexed_sections": len(rag_pipeline.documents),
            "message": f"Reindexed {len(rag_pipeline.documents)} Qatar Labour Law policy sections."
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
