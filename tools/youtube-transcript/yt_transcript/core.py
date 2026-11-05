"""Core logic: turn a YouTube link into a transcript.

Shared by the CLI, the MCP server (for Claude) and the web UI.
"""

from __future__ import annotations

import os
import re
from dataclasses import dataclass, field
from urllib.parse import parse_qs, urlparse

import requests
from youtube_transcript_api import YouTubeTranscriptApi
from youtube_transcript_api import (
    AgeRestricted,
    InvalidVideoId,
    IpBlocked,
    NoTranscriptFound,
    RequestBlocked,
    TranscriptsDisabled,
    VideoUnavailable,
    YouTubeTranscriptApiException,
)
from youtube_transcript_api.proxies import GenericProxyConfig, WebshareProxyConfig

_ID_RE = re.compile(r"^[A-Za-z0-9_-]{11}$")
_YT_HOSTS = {
    "youtube.com",
    "www.youtube.com",
    "m.youtube.com",
    "music.youtube.com",
    "youtube-nocookie.com",
    "www.youtube-nocookie.com",
}


class TranscriptError(Exception):
    """A user-facing error with a plain-English message."""


def extract_video_id(url_or_id: str) -> str:
    """Accept any common YouTube link format (or a bare 11-char ID) and return the video ID."""
    s = (url_or_id or "").strip()
    if _ID_RE.match(s):
        return s
    if "://" not in s:
        s = "https://" + s
    parsed = urlparse(s)
    host = (parsed.hostname or "").lower()
    parts = [p for p in parsed.path.split("/") if p]

    candidate = None
    if host in ("youtu.be", "www.youtu.be"):
        candidate = parts[0] if parts else None
    elif host in _YT_HOSTS:
        if parsed.path == "/watch" or parts[:1] == ["watch"]:
            candidate = parse_qs(parsed.query).get("v", [None])[0]
        elif len(parts) >= 2 and parts[0] in ("shorts", "embed", "live", "v", "e"):
            candidate = parts[1]
        elif parts[:1] == ["attribution_link"]:
            u = parse_qs(parsed.query).get("u", [""])[0]
            candidate = parse_qs(urlparse(u).query).get("v", [None])[0]

    if candidate and _ID_RE.match(candidate):
        return candidate
    raise TranscriptError(f"That doesn't look like a YouTube video link: {url_or_id!r}")


def _proxy_config():
    """Optional proxy, needed when running on cloud servers (YouTube blocks most datacenter IPs)."""
    user, pw = os.getenv("WEBSHARE_PROXY_USERNAME"), os.getenv("WEBSHARE_PROXY_PASSWORD")
    if user and pw:
        return WebshareProxyConfig(proxy_username=user, proxy_password=pw)
    url = os.getenv("YT_TRANSCRIPT_PROXY")
    if url:
        return GenericProxyConfig(http_url=url, https_url=url)
    return None


@dataclass
class Segment:
    start: float
    duration: float
    text: str


@dataclass
class Transcript:
    video_id: str
    language: str
    language_code: str
    is_generated: bool
    segments: list[Segment] = field(default_factory=list)

    @property
    def url(self) -> str:
        return f"https://www.youtube.com/watch?v={self.video_id}"

    def as_text(self, timestamps: bool = False) -> str:
        if timestamps:
            return "\n".join(f"[{fmt_ts(s.start)}] {s.text}" for s in self.segments)
        # Join into readable paragraphs (~ every 30 seconds) instead of one line per caption.
        paras, buf, para_start = [], [], 0.0
        for s in self.segments:
            if not buf:
                para_start = s.start
            buf.append(s.text.replace("\n", " ").strip())
            if s.start - para_start >= 30 and buf[-1][-1:] in ".?!":
                paras.append(" ".join(buf))
                buf = []
        if buf:
            paras.append(" ".join(buf))
        return "\n\n".join(p for p in paras if p)

    def to_dict(self) -> dict:
        return {
            "video_id": self.video_id,
            "url": self.url,
            "language": self.language,
            "language_code": self.language_code,
            "is_generated": self.is_generated,
            "segments": [s.__dict__ for s in self.segments],
        }


def fmt_ts(seconds: float) -> str:
    seconds = int(seconds)
    h, rem = divmod(seconds, 3600)
    m, s = divmod(rem, 60)
    return f"{h}:{m:02d}:{s:02d}" if h else f"{m:02d}:{s:02d}"


def fetch_transcript(url_or_id: str, languages: list[str] | None = None) -> Transcript:
    """Fetch a transcript. Prefers the requested languages, otherwise falls back to whatever exists."""
    video_id = extract_video_id(url_or_id)
    languages = languages or ["en"]
    api = YouTubeTranscriptApi(proxy_config=_proxy_config())
    try:
        tlist = api.list(video_id)
        try:
            t = tlist.find_transcript(languages)
        except NoTranscriptFound:
            # Fall back to the first available transcript (manual first, then auto-generated).
            available = list(tlist)
            if not available:
                raise
            available.sort(key=lambda x: x.is_generated)
            t = available[0]
        fetched = t.fetch()
    except TranscriptsDisabled:
        raise TranscriptError("Captions are turned off for this video, so there's no transcript.")
    except NoTranscriptFound:
        raise TranscriptError("This video has no transcript available.")
    except (VideoUnavailable, InvalidVideoId):
        raise TranscriptError("That video is unavailable (private, deleted, or the link is wrong).")
    except AgeRestricted:
        raise TranscriptError("This video is age-restricted, so YouTube won't share its transcript.")
    except (IpBlocked, RequestBlocked):
        raise TranscriptError(
            "YouTube is blocking requests from this machine's IP address. This is common on cloud "
            "servers. Run it from your own computer, or set a proxy (see README)."
        )
    except YouTubeTranscriptApiException as e:
        raise TranscriptError(f"Couldn't fetch the transcript: {e.__class__.__name__}")
    except requests.RequestException:
        raise TranscriptError("Couldn't reach YouTube. Check your internet connection (or proxy) and try again.")

    return Transcript(
        video_id=video_id,
        language=fetched.language,
        language_code=fetched.language_code,
        is_generated=fetched.is_generated,
        segments=[Segment(s.start, s.duration, s.text) for s in fetched.snippets],
    )
