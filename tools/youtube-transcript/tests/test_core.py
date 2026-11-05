import sys
from pathlib import Path
from types import SimpleNamespace
from unittest import mock

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from yt_transcript import core  # noqa: E402
from yt_transcript.core import TranscriptError, extract_video_id  # noqa: E402

VID = "dQw4w9WgXcQ"


@pytest.mark.parametrize(
    "url",
    [
        VID,
        f"https://www.youtube.com/watch?v={VID}",
        f"https://youtube.com/watch?v={VID}&t=42s&list=abc",
        f"youtube.com/watch?v={VID}",
        f"https://m.youtube.com/watch?v={VID}",
        f"https://youtu.be/{VID}",
        f"https://youtu.be/{VID}?si=xyz&t=10",
        f"https://www.youtube.com/shorts/{VID}",
        f"https://www.youtube.com/embed/{VID}",
        f"https://www.youtube.com/live/{VID}?feature=share",
        f"https://www.youtube-nocookie.com/embed/{VID}",
        f"https://music.youtube.com/watch?v={VID}",
        f"  https://youtu.be/{VID}  ",
    ],
)
def test_extract_video_id(url):
    assert extract_video_id(url) == VID


@pytest.mark.parametrize("bad", ["", "hello", "https://vimeo.com/123456", "https://www.youtube.com/watch?v=short"])
def test_extract_video_id_rejects(bad):
    with pytest.raises(TranscriptError):
        extract_video_id(bad)


def _fake_api(snippets, generated=False):
    fetched = SimpleNamespace(
        language="English", language_code="en", is_generated=generated,
        snippets=[SimpleNamespace(start=s, duration=2.0, text=t) for s, t in snippets],
    )
    tr = SimpleNamespace(is_generated=generated, fetch=lambda: fetched)
    tlist = mock.MagicMock()
    tlist.find_transcript.return_value = tr
    api = mock.MagicMock()
    api.list.return_value = tlist
    return api


def test_fetch_and_format():
    api = _fake_api([(0, "Hello there."), (5, "Second line."), (65, "After a minute.")])
    with mock.patch.object(core, "YouTubeTranscriptApi", return_value=api):
        t = core.fetch_transcript(f"https://youtu.be/{VID}")
    assert t.video_id == VID
    assert t.as_text(timestamps=True) == "[00:00] Hello there.\n[00:05] Second line.\n[01:05] After a minute."
    assert "Hello there. Second line." in t.as_text()
    assert t.to_dict()["url"].endswith(VID)


def test_friendly_error_on_network_failure():
    api = mock.MagicMock()
    api.list.side_effect = core.requests.ConnectionError("boom")
    with mock.patch.object(core, "YouTubeTranscriptApi", return_value=api):
        with pytest.raises(TranscriptError, match="Couldn't reach YouTube"):
            core.fetch_transcript(VID)


def test_friendly_error_when_disabled():
    api = mock.MagicMock()
    api.list.side_effect = core.TranscriptsDisabled(VID)
    with mock.patch.object(core, "YouTubeTranscriptApi", return_value=api):
        with pytest.raises(TranscriptError, match="Captions are turned off"):
            core.fetch_transcript(VID)
