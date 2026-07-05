import os
import sys
import re

# Ensure the backend directory is in the Python search path for Vercel serverless deployment
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import chat, brand, summarize

app = FastAPI(
    title="YouTube AI Companion API",
    version="1.0.0",
)

# Set up CORS origins matching:
# 1. The frontend deployment URL (https://popown.vercel.app)
# 2. Localhost for development (e.g., http://localhost:5173, http://127.0.0.1:5173, etc.)
# 3. Chrome extensions (chrome-extension://<id>)
cors_regex = r"^(https://popown\.vercel\.app|http://localhost(:\d+)?|http://127\.0\.0\.1(:\d+)?|chrome-extension://[a-zA-Z0-9]+)$"


app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=cors_regex,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(chat.router, prefix="/api")
app.include_router(brand.router, prefix="/api")
app.include_router(summarize.router, prefix="/api")


@app.get("/")
def read_root():
    return {
        "message": "Welcome to Popown YouTube AI Companion API",
        "status": "running",
        "docs": "/docs"
    }


@app.get("/health")
def health():
    return {"status": "ok"}


# Trigger reload for new env config


