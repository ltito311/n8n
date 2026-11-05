# YouTube Transcript Tool

Paste a YouTube link and get the transcript. One core, three ways to use it:

| Use it from | How |
|---|---|
| **Claude** (Desktop or Claude Code) | MCP server: Claude gets a `get_youtube_transcript` tool, so you just paste a link in chat |
| **Terminal** | `python -m yt_transcript <link>` |
| **Browser** | `python -m yt_transcript.web`, then open http://localhost:8000 |

Works with `youtube.com/watch`, `youtu.be`, `/shorts/`, `/embed/`, `/live/`, `m.` and `music.` links, or a bare video ID.

## Install (once)

Requires Python 3.10+.

```bash
cd tools/youtube-transcript
python3 -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

## 1. Use it in Claude

### Claude Desktop
Open **Settings → Developer → Edit Config** (`claude_desktop_config.json`) and add the following. Use the full paths on your machine.

```json
{
  "mcpServers": {
    "youtube-transcript": {
      "command": "/FULL/PATH/TO/tools/youtube-transcript/.venv/bin/python",
      "args": ["-m", "yt_transcript.mcp_server"],
      "cwd": "/FULL/PATH/TO/tools/youtube-transcript"
    }
  }
}
```
On Windows the python path is `...\\.venv\\Scripts\\python.exe`. Restart Claude Desktop.

### Claude Code
From inside `tools/youtube-transcript`:
```bash
claude mcp add youtube-transcript --scope user -- "$PWD/.venv/bin/python" -m yt_transcript.mcp_server
```
(Run it from this folder, or add `PYTHONPATH=$PWD` via `-e PYTHONPATH="$PWD"`, so Python can find the package.)

Then in a chat, paste a link: *"Summarize this: https://youtu.be/…"*. Claude calls the tool itself. You can also ask for timestamps or a specific language.

## 2. Terminal

```bash
python -m yt_transcript https://youtu.be/VIDEO_ID           # readable paragraphs
python -m yt_transcript https://youtu.be/VIDEO_ID -t        # with [mm:ss] timestamps
python -m yt_transcript https://youtu.be/VIDEO_ID --json    # every segment, as JSON
python -m yt_transcript https://youtu.be/VIDEO_ID --lang es,en
```

## 3. Web interface

```bash
python -m yt_transcript.web          # http://localhost:8000
```
It has a paste box, a timestamps toggle, Copy, and Download .txt.
There's also a JSON API: `GET /api/transcript?url=<link>&lang=en`.

### Putting it online later
```bash
docker build -t yt-transcript .
docker run -p 8000:8000 yt-transcript
```
This runs on any container host (Render, Railway, Fly.io, Cloud Run…).

**Important:** YouTube blocks most cloud/datacenter IP addresses from fetching transcripts. The tool works fine from your own computer, but a hosted copy will usually need a residential proxy. Set one of:
- `WEBSHARE_PROXY_USERNAME` + `WEBSHARE_PROXY_PASSWORD` (Webshare rotating residential proxies), or
- `YT_TRANSCRIPT_PROXY=http://user:pass@host:port` (any HTTP proxy)

If you expose it publicly, add a login or rate limit in front of it.

## Notes
- Only videos that have captions (manual or auto-generated) have a transcript. If your preferred language isn't available, the tool falls back to whatever language exists.
- Tests: `pip install pytest && python -m pytest tests`
