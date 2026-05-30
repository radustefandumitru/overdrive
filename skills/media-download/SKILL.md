---
name: media-download
description: Use when the user asks to download, save, extract audio from, or convert a video/media URL using yt-dlp, including MP3 audio and highest-quality MP4 downloads. Supports YouTube and many other yt-dlp-supported sites. Ask for or choose a target folder, defaulting to ~/Downloads when reasonable.
---

# Media Download

Use this for local, user-requested media downloads through `yt-dlp`. Respect platform terms and the user's rights to the media.

## Preflight

1. Confirm the URL and desired output format if either is unclear.
2. Choose a target folder:
   - Use a user-provided folder when given.
   - Otherwise default to `~/Downloads`.
3. Check whether `yt-dlp` is available:

```bash
command -v yt-dlp
```

If missing, suggest:

```bash
brew install yt-dlp
```

## Common Commands

MP3 audio:

```bash
yt-dlp -P "$HOME/Downloads" -x --audio-format mp3 "<url>"
```

Highest-quality MP4 with broadly compatible codecs:

```bash
yt-dlp -P "$HOME/Downloads" -S vcodec:h264,fps,res,acodec:m4a "<url>"
```

Specific target folder:

```bash
yt-dlp -P "/path/to/folder" -x --audio-format mp3 "<url>"
yt-dlp -P "/path/to/folder" -S vcodec:h264,fps,res,acodec:m4a "<url>"
```

## Output

After running, report:

- The format downloaded.
- The output folder.
- Any warnings from `yt-dlp` that affect the result.

Do not paste long download logs unless they are needed for debugging.

## Notes

- `yt-dlp` supports many sites beyond YouTube. If a site fails, update `yt-dlp` first, then retry.
- For copyrighted or restricted material, ask the user to confirm they have permission before proceeding.
- This skill replaces the previous upstream `video-downloader` skill with a smaller local wrapper.

## Attribution

Built around the open-source `yt-dlp` project: https://github.com/yt-dlp/yt-dlp
