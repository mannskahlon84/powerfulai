import os
from pathlib import Path
from typing import Optional
from pydantic import BaseModel, Field

# Base directories
BASE_DIR = Path(__file__).resolve().parent.parent
POLICY_DOCS_DIR = BASE_DIR / "rag" / "policy_docs"

# Helper to load .env manually if dotenv not present
def load_env():
    env_path = BASE_DIR.parent / ".env"
    if env_path.exists():
        with open(env_path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    key, val = line.split("=", 1)
                    key = key.strip()
                    val = val.strip().strip('"').strip("'")
                    if key not in os.environ:
                        os.environ[key] = val

load_env()


class Settings(BaseModel):
    """
    Application settings for HR AI Assistant Microservice.
    """
    APP_NAME: str = "HR AI Assistant Microservice (Qatar Labour Law Edition)"
    APP_VERSION: str = "1.0.0"
    
    # Gemini API Configuration
    GEMINI_API_KEY: str = Field(default_factory=lambda: os.getenv("GEMINI_API_KEY", ""))
    GEMINI_MODEL: str = "gemini-2.5-pro"  # Use strong Gemini model
    
    # Odoo XML-RPC / JSON-RPC Configuration
    ODOO_URL: str = Field(default_factory=lambda: os.getenv("ODOO_URL", "http://localhost:8069"))
    ODOO_DB: str = Field(default_factory=lambda: os.getenv("ODOO_DB", "odoo_hr_db"))
    ODOO_USER: str = Field(default_factory=lambda: os.getenv("ODOO_USER", "admin@company.qa"))
    ODOO_PASSWORD: str = Field(default_factory=lambda: os.getenv("ODOO_PASSWORD", "admin"))
    USE_MOCK_ODOO: bool = Field(default_factory=lambda: os.getenv("USE_MOCK_ODOO", "True").lower() in ("true", "1", "yes"))
    
    # RAG Knowledge Base Configuration
    POLICY_DOCS_DIR: Path = POLICY_DOCS_DIR
    CHROMA_PERSIST_DIR: str = str(BASE_DIR / "rag" / "chroma_db")


settings = Settings()
