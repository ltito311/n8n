# Glint

Async video messaging. Record screen + camera, share a link, and Groq writes the title, summary, chapters and action items.

```bash
cd glint
cp .env.example .env   # put GROQ_API_KEY in it
npm install
npm start              # http://localhost:4747
```

## Features
- **Recorder**: screen + camera bubble, screen only, or camera only. Bubble corner and size, 720p/1080p/1440p, mic and system audio mix, live level meter, countdown, pause/resume, restart, discard, hide the camera mid-take, a floating controls window (Document PiP) and hotkeys (Alt+P, Alt+S, Alt+C).
- **Transcript**: Groq Whisper (`whisper-large-v3-turbo`) after upload; live browser captions as a fallback.
- **AI (Groq)**: auto title, summary, chapters, action items and tags; an "Ask this video" chat that answers with clickable timestamps; Slack and email share-message drafts.
- **Player**: custom controls, chapter markers, reaction markers, 0.75–2.5× speed, captions overlay, PiP, fullscreen and YouTube-style keys (space, j/k/l, arrows, 0–9, f, m, c, < >).
- **Collaboration**: timestamped comments, emoji reactions, view counts, copy link, download, non-destructive trim, inline title editing.
- **Library**: full-text search across titles, summaries and transcripts, plus sorting and stats.

If ffmpeg is installed, uploads are remuxed so WebM files seek properly. Data lives in `glint/data/`.
