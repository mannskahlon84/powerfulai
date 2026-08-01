import os
from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from app.core.config import settings
from app.api.endpoints import chat, odoo, rag

# Initialize FastAPI Application
app = FastAPI(
    title=settings.APP_NAME,
    description=(
        "Production-ready **HR AI Assistant Microservice** powered by an **Intentional Tool Calling Agent** "
        "(Read-Only default access & Write-Guarded DRAFT state for Odoo hr.leave), "
        "integrated with a **Qatar Labour Law (Law No. 14 of 2004)** RAG pipeline and **Human-in-the-Loop** approval workflow."
    ),
    version=settings.APP_VERSION,
    docs_url="/docs",
    redoc_url="/redoc"
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API Router prefixes
api_prefix = "/api/v1"
app.include_router(chat.router, prefix=api_prefix)
app.include_router(odoo.router, prefix=api_prefix)
app.include_router(rag.router, prefix=api_prefix)

# Setup static files directory for Web Dashboard
BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR / "static"
if not STATIC_DIR.exists():
    STATIC_DIR.mkdir(parents=True, exist_ok=True)

app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")


@app.get("/", summary="Web Dashboard Interface", tags=["Frontend"])
async def serve_dashboard():
    """
    Serves the clean, responsive Tailwind CSS Web Dashboard with Human-in-the-Loop approval UI,
    Live Odoo database viewer, and RAG knowledge base explorer.
    """
    index_path = STATIC_DIR / "index.html"
    if not index_path.exists():
        return {"error": "Dashboard index.html not found. Please build or check static files."}
    return FileResponse(index_path)


@app.get("/api/health", summary="Microservice Health Check", tags=["Health"])
async def health_check():
    """
    Health check endpoint verifying RAG pipeline index and Mock Odoo state.
    """
    from app.rag.pipeline import rag_pipeline
    from app.services.odoo.client import odoo_client
    
    return {
        "status": "healthy",
        "app_name": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "use_mock_odoo": settings.USE_MOCK_ODOO,
        "rag_indexed_sections": len(rag_pipeline.documents),
        "employees_in_odoo": len(odoo_client.get_all_employees()),
        "time": "2026-07-29T13:22:00+03:00"
    }
