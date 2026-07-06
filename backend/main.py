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
    import os
    import traceback
    import shutil
    
    current_dir = os.path.dirname(os.path.abspath(__file__))
    cookies_file = os.path.join(current_dir, "yt-cookies.txt")
    exists = os.path.exists(cookies_file)
    size = os.path.getsize(cookies_file) if exists else -1
    
    # Copy cookies to /tmp to avoid Read-only file system error when yt-dlp tries to save/update it
    tmp_cookies = "/tmp/yt-cookies.txt"
    if exists:
        try:
            shutil.copy2(cookies_file, tmp_cookies)
            cookies_to_use = tmp_cookies
        except Exception as e:
            cookies_to_use = cookies_file
    else:
        cookies_to_use = None

    from utils.transcript import _try_youtube_transcript_api
    
    yt_api_res = "not run"
    yt_api_error = ""
    ytdlp_res = "not run"
    ytdlp_error = ""
    google_api_res = "not run"
    google_api_error = ""
    
    # 1. Test youtube-transcript-api
    try:
        res = _try_youtube_transcript_api("xlWhpXdOlTo", ["en", "id"], cookies_to_use)
        if res:
            yt_api_res = f"success: {len(res)} lines"
        else:
            yt_api_res = "failed: returned None"
    except Exception as e:
        yt_api_res = "error"
        yt_api_error = f"{str(e)}\n{traceback.format_exc()}"
        
    # 2. Test yt-dlp
    try:
        import yt_dlp
        url = "https://www.youtube.com/watch?v=xlWhpXdOlTo"
        # Remove android_vr to let yt-dlp try standard clients like iOS/web
        ydl_opts = {
            "quiet": True,
            "no_warnings": True,
            "skip_download": True,
            "extract_flat": False,
        }
        if cookies_to_use:
            ydl_opts["cookiefile"] = cookies_to_use
            
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)
        subtitles = info.get("subtitles", {}) or {}
        auto_captions = info.get("automatic_captions", {}) or {}
        ytdlp_res = f"success: extracted subtitles={list(subtitles.keys())}, auto={list(auto_captions.keys())}"
    except Exception as e:
        ytdlp_res = "error"
        ytdlp_error = f"{str(e)}\n{traceback.format_exc()}"

    # 3. Test Google API
    try:
        from config import GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, YOUTUBE_REFRESH_TOKEN
        from utils.youtube_api import get_transcript_from_youtube_api
        if not GOOGLE_CLIENT_ID or not GOOGLE_CLIENT_SECRET or not YOUTUBE_REFRESH_TOKEN:
            google_api_res = "skipped: credentials missing in config"
        else:
            res = get_transcript_from_youtube_api("xlWhpXdOlTo", "id", YOUTUBE_REFRESH_TOKEN, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET)
            if res:
                google_api_res = f"success: {len(res)} lines"
            else:
                google_api_res = "failed: returned None"
    except Exception as e:
        google_api_res = "error"
        google_api_error = f"{str(e)}\n{traceback.format_exc()}"

    return {
        "status": "ok",
        "cookies": {
            "resolved_path": cookies_file,
            "exists": exists,
            "size": size,
            "cwd": os.getcwd(),
            "copied_to_tmp": os.path.exists(tmp_cookies)
        },
        "diagnostics": {
            "youtube_transcript_api": {"result": yt_api_res, "error": yt_api_error},
            "yt_dlp": {"result": ytdlp_res, "error": ytdlp_error},
            "google_api": {"result": google_api_res, "error": google_api_error}
        }
    }






# Trigger reload for new env config


