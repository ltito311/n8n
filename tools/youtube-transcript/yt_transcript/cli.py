"""Command line: python -m yt_transcript <youtube-link> [--timestamps] [--json] [--lang en,es]"""

import argparse
import json
import sys

from .core import TranscriptError, fetch_transcript


def main(argv=None) -> int:
    p = argparse.ArgumentParser(prog="yt-transcript", description="Get the transcript of a YouTube video.")
    p.add_argument("url", help="YouTube link (or video ID)")
    p.add_argument("-t", "--timestamps", action="store_true", help="include [mm:ss] timestamps")
    p.add_argument("--json", action="store_true", help="output JSON with every caption segment")
    p.add_argument("--lang", default="en", help="preferred languages, comma separated (default: en)")
    args = p.parse_args(argv)

    try:
        t = fetch_transcript(args.url, [l.strip() for l in args.lang.split(",") if l.strip()])
    except TranscriptError as e:
        print(f"Error: {e}", file=sys.stderr)
        return 1

    if args.json:
        print(json.dumps(t.to_dict(), ensure_ascii=False, indent=2))
    else:
        print(t.as_text(timestamps=args.timestamps))
    return 0


if __name__ == "__main__":
    sys.exit(main())
