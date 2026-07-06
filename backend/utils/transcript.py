import os
import time
import logging
import requests as requests_lib
from youtube_transcript_api import YouTubeTranscriptApi
from youtube_transcript_api._errors import NoTranscriptFound, TooManyRequests, YouTubeRequestFailed
import yt_dlp

from config import GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, YOUTUBE_REFRESH_TOKEN

logger = logging.getLogger(__name__)

_cache: dict[str, list[dict]] = {}


def _retry(fn, retries=6, base_delay=2):
    for attempt in range(retries):
        try:
            return fn()
        except (TooManyRequests, YouTubeRequestFailed):
            if attempt == retries - 1:
                raise
            delay = base_delay * (2 ** attempt)
            time.sleep(delay)
    return None


def _cache_key(video_id: str, languages: list[str]) -> str:
    return f"{video_id}:{','.join(languages)}"


def get_transcript(
    video_id: str,
    languages: list[str] | None = None,
    cookies: str | None = None,
) -> list[dict]:
    if languages is None:
        languages = ["en", "id"]

    # Automatically resolve yt-cookies.txt in the backend root directory if not specified
    if cookies is None:
        current_dir = os.path.dirname(os.path.abspath(__file__))
        backend_dir = os.path.dirname(current_dir)
        cookies_file = os.path.join(backend_dir, "yt-cookies.txt")
        if os.path.exists(cookies_file):
            cookies = cookies_file

    # Copy to /tmp to avoid Read-only file system error in serverless environments (Vercel)
    if cookies and os.path.exists(cookies) and cookies != "/tmp/yt-cookies.txt":
        try:
            import shutil
            tmp_cookies = "/tmp/yt-cookies.txt"
            shutil.copy2(cookies, tmp_cookies)
            cookies = tmp_cookies
        except Exception:
            pass

    key = _cache_key(video_id, languages)
    cached = _cache.get(key)
    if cached is not None:
        return cached

    try:
        result = _retry(lambda: _try_youtube_transcript_api(video_id, languages, cookies))
    except Exception:
        result = None

    if result:
        _cache[key] = result
        return result

    try:
        result = _retry(lambda: _try_ytdlp_captions(video_id, languages, cookies=cookies))
    except Exception:
        result = None

    if result:
        _cache[key] = result
        return result

    result = _try_google_api(video_id, languages)
    if result:
        _cache[key] = result
        return result

    raise RuntimeError(
        "No accessible transcript found for this video. "
        "Try a different video or specify a supported language."
    )


def _try_youtube_transcript_api(
    video_id: str, languages: list[str], cookies: str | None
):
    kwargs = {}
    if cookies:
        kwargs["cookies"] = cookies

    try:
        transcript = YouTubeTranscriptApi.get_transcript(
            video_id, languages=languages, **kwargs
        )
        if transcript:
            return _format(transcript)
    except NoTranscriptFound:
        pass
    except TooManyRequests:
        raise

    try:
        transcript_list = YouTubeTranscriptApi.list_transcripts(
            video_id, **kwargs
        )
        for t in transcript_list:
            if t.is_translatable:
                tr = t.translate("en")
                data = tr.fetch(**kwargs)
                if data:
                    return _format(data)
        for t in transcript_list:
            data = t.fetch(**kwargs)
            if data:
                return _format(data)
    except TooManyRequests:
        raise
    except Exception:
        pass

    return None


def _try_ytdlp_captions(
    video_id: str, languages: list[str], cookies: str | None = None
) -> list[dict] | None:
    import http.cookiejar

    url = f"https://www.youtube.com/watch?v={video_id}"
    ydl_opts = {
        "quiet": True,
        "no_warnings": True,
        "skip_download": True,
        "extract_flat": False,
    }
    cookies_jar = None
    if cookies and os.path.exists(cookies):
        ydl_opts["cookiefile"] = cookies
        try:
            cookies_jar = http.cookiejar.MozillaCookieJar(cookies)
            cookies_jar.load(ignore_discard=True, ignore_expires=True)
        except Exception as e:
            logger.warning("Failed to load cookies into jar: %s", e)

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)

        captions = info.get("subtitles", {}) or {}
        auto_captions = info.get("automatic_captions", {}) or {}

        for lang in languages:
            for source in (captions, auto_captions):
                if lang in source:
                    for fmt in source[lang]:
                        if fmt.get("ext") == "json3":
                            kwargs = {"timeout": 30}
                            if cookies_jar:
                                kwargs["cookies"] = cookies_jar
                            r = requests_lib.get(fmt["url"], **kwargs)
                            if r.status_code == 429:
                                raise TooManyRequests()
                            if r.status_code == 200:
                                data = r.json()
                                events = data.get("events", [])
                                result = []
                                for ev in events:
                                    segs = ev.get("segs", [])
                                    for seg in segs:
                                        text = seg.get("utf8", "").strip()
                                        if text:
                                            result.append({
                                                "text": text,
                                                "start": ev.get("tStartMs", 0) / 1000,
                                                "duration": ev.get("dDurationMs", 0) / 1000,
                                            })
                                if result:
                                    return _merge_contiguous(result)
    except Exception:
        pass

    return None


def _try_google_api(video_id: str, languages: list[str]) -> list[dict] | None:
    if not GOOGLE_CLIENT_ID or not GOOGLE_CLIENT_SECRET or not YOUTUBE_REFRESH_TOKEN:
        return None

    from utils.youtube_api import get_transcript_from_youtube_api

    for lang in languages:
        try:
            result = get_transcript_from_youtube_api(
                video_id=video_id,
                language=lang,
                refresh_token=YOUTUBE_REFRESH_TOKEN,
                client_id=GOOGLE_CLIENT_ID,
                client_secret=GOOGLE_CLIENT_SECRET,
            )
            if result:
                return result
        except Exception as exc:
            logger.warning("YouTube API failed for %s lang=%s: %s", video_id, lang, exc)

    return None


def _format(transcript):
    return [
        {
            "text": entry["text"],
            "start": entry["start"],
            "duration": entry["duration"],
        }
        for entry in transcript
    ]


def format_transcript_text(transcript: list[dict], max_chars: int | None = None) -> str:
    text = "\n".join(
        f"[{entry['start']:.0f}s] {entry['text']}" for entry in transcript
    )
    if max_chars and len(text) > max_chars:
        half = max_chars // 2
        head = text[:half]
        tail = text[-half:]
        text = head + "\n...[mid-section truncated]...\n" + tail
    return text


def _merge_contiguous(entries: list[dict]) -> list[dict]:
    if not entries:
        return []
    merged = [entries[0]]
    for e in entries[1:]:
        prev = merged[-1]
        gap = e["start"] - (prev["start"] + prev["duration"])
        if gap < 1.0:
            prev["text"] += " " + e["text"]
            prev["duration"] = e["start"] + e["duration"] - prev["start"]
        else:
            merged.append(e)
    return merged
