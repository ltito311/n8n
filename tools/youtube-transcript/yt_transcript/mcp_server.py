"""MCP server so Claude (Claude Desktop / Claude Code) can fetch YouTube transcripts itself.

Run: python -m yt_transcript.mcp_server
"""

from mcp.server.mcpserver import MCPServer

from .core import TranscriptError, fetch_transcript

server = MCPServer(
    name="youtube-transcript",
    instructions="Use get_youtube_transcript whenever the user shares a YouTube link and wants its content.",
)


@server.tool()
def get_youtube_transcript(url: str, timestamps: bool = False, languages: str = "en") -> str:
    """Fetch the transcript of a YouTube video.

    Args:
        url: Any YouTube link (watch, youtu.be, shorts, embed, live) or an 11-character video ID.
        timestamps: If true, prefix each caption line with [mm:ss].
        languages: Preferred language codes, comma separated (e.g. "en,es"). Falls back to any available.
    """
    try:
        t = fetch_transcript(url, [l.strip() for l in languages.split(",") if l.strip()])
    except TranscriptError as e:
        return f"Error: {e}"
    kind = "auto-generated" if t.is_generated else "manual"
    header = f"Transcript for {t.url} ({t.language}, {kind} captions)\n\n"
    return header + t.as_text(timestamps=timestamps)


def main():
    server.run()


if __name__ == "__main__":
    main()
