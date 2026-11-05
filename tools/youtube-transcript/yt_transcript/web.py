"""Tiny web UI: paste a link, get the transcript.

Run: python -m yt_transcript.web   (then open http://localhost:8000)
Env: PORT (default 8000), HOST (default 127.0.0.1; use 0.0.0.0 when deploying)
"""

import json
import os
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

from .core import TranscriptError, fetch_transcript

INDEX_HTML = (Path(__file__).parent / "static" / "index.html").read_bytes()


class Handler(BaseHTTPRequestHandler):
    def _send(self, status: int, body: bytes, ctype: str):
        self.send_response(status)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _json(self, status: int, data: dict):
        self._send(status, json.dumps(data, ensure_ascii=False).encode(), "application/json; charset=utf-8")

    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path in ("/", "/index.html"):
            return self._send(200, INDEX_HTML, "text/html; charset=utf-8")
        if parsed.path == "/health":
            return self._json(200, {"ok": True})
        if parsed.path == "/api/transcript":
            q = parse_qs(parsed.query)
            url = q.get("url", [""])[0]
            langs = [l for l in q.get("lang", ["en"])[0].split(",") if l]
            if not url:
                return self._json(400, {"error": "Missing ?url="})
            try:
                t = fetch_transcript(url, langs)
            except TranscriptError as e:
                return self._json(422, {"error": str(e)})
            data = t.to_dict()
            data["text"] = t.as_text()
            data["text_with_timestamps"] = t.as_text(timestamps=True)
            return self._json(200, data)
        self._json(404, {"error": "Not found"})


def main():
    host = os.getenv("HOST", "127.0.0.1")
    port = int(os.getenv("PORT", "8000"))
    print(f"YouTube transcript tool running at http://{'localhost' if host == '127.0.0.1' else host}:{port}")
    ThreadingHTTPServer((host, port), Handler).serve_forever()


if __name__ == "__main__":
    main()
