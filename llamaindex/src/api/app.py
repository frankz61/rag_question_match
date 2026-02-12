from fastapi import FastAPI

from src.api.routes import router as api_router

app = FastAPI(title="OCR Match API", version="1.0.0")
app.include_router(api_router, prefix="/api/v1")
