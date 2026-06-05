# Publishing Overdrive

This kit is designed to be published as a public GitHub repo and installed from clone, release archive, or GitHub `npx`.

Public repo:

[radustefandumitru/overdrive](https://github.com/radustefandumitru/overdrive)

## Public-Safe Shape

Publish the installer, manifest, local Overdrive skills, global instruction templates, docs, and source notices.

Do not publish:

- Raw/private skill snapshots or vendored third-party copies unless every upstream license has been reviewed and redistribution is allowed.
- API keys, OAuth tokens, MCP configs with credentials, service-role keys, database URLs, browser profiles, cookies, or app sessions.
- `.overdrive/` runtime state, knowledge-vault files, converted Markdown caches, route traces, handoffs, or local workflow reports.
- Jack Roberts raw PDFs, zips, templates, downloaded folders, prompts, private community/course material, or copied third-party skill text.
- Personal account state for GitHub, Vercel, Supabase, Firecrawl, Google, Claude, Codex, Gemini, Antigravity, Cursor, or any other service.
- Cursor's built-in `~/.cursor/skills-cursor` content.

The public framing should be:

- Overdrive is a curated installer and router.
- Original creators keep credit for their work.
- The installer pulls approved sources from upstream repos or official installers.
- Default installs use verified pinned source refs and package versions from `VERIFIED_SOURCES.md`.
- Local skills authored for this kit are paraphrased, attributed, and public-safe.
- Context7 guidance is included as the public-standard MCP recommendation.
- Other MCPs/connectors are intentionally left to each user's own runtime and projects.

## Publish Commands

From your local Overdrive checkout:

```bash
git init
git add .
git commit -m "Initial Overdrive installer"
git branch -M main
git remote add origin https://github.com/radustefandumitru/overdrive.git
git push -u origin main
```

If a remote already exists:

```bash
git remote -v
git remote set-url origin https://github.com/radustefandumitru/overdrive.git
git push -u origin main
```

Before pushing, run:

```bash
bash -n install.sh verify.sh check-updates.sh update.sh uninstall.sh
node --check lib/installer.js
node --check bin/overdrive.js
npm run consistency
npm run eval:router
npm run analyze:routes
./install.sh --dry-run
./install.sh --list-targets
./check-updates.sh
./uninstall.sh --dry-run
npm pack --dry-run
```

## Install Commands For Users

Clone:

```bash
git clone https://github.com/radustefandumitru/overdrive.git
cd Overdrive
./install.sh --dry-run
./install.sh
```

Safe preview:

```bash
./install.sh --dry-run
```

GitHub `npx`:

```bash
npx -y github:radustefandumitru/overdrive -- --dry-run
npx -y github:radustefandumitru/overdrive
```

Release archive:

```bash
unzip Overdrive.zip
cd Overdrive
./install.sh
```

## Power User Examples

Global auto-detection with safe defaults:

```bash
./install.sh --scope global --tools auto --conflict preserve
```

Skip optional helper tool setup:

```bash
./install.sh --scope global --tools auto --conflict preserve --no-tool-install
```

Global manual target install:

```bash
./install.sh --scope global --tools cursor,codex --conflict backup-and-replace
```

Local project install:

```bash
./install.sh --scope local --project-dir . --conflict preserve
```

Update cloned kit plus previously managed skills:

```bash
./update.sh
```

Refresh all matching skills from upstream with timestamped backups:

```bash
./update.sh --all-skills
```

Check for a newer kit release or upstream skill tracking refs without applying changes:

```bash
./check-updates.sh
```

GitHub `npx` update path:

```bash
npx -y github:radustefandumitru/overdrive update-skills
npx -y github:radustefandumitru/overdrive update-skills --all-skills
```

Use live upstream branches/latest packages only when intentionally reviewing fresh upstream changes:

```bash
./update.sh --allow-upstream-drift
```

Safe uninstall:

```bash
./uninstall.sh --dry-run
./uninstall.sh
```

## Release Archive

The public GitHub repo is the source of truth. If you need a zip for upload, review, or release assets, build one from committed files instead of zipping the working tree. Keep maintainer-only drafts such as `SOCIAL_POSTS.md` out of the archive:

```bash
cd /path/to/Overdrive
git archive --format=zip --output ../Overdrive.zip --prefix=Overdrive/ HEAD -- . ':(exclude)SOCIAL_POSTS.md'
```

Quickly inspect the archive before sharing it:

```bash
if unzip -l ../Overdrive.zip | rg "bundled/skills|sources.lock|\\.DS_Store|(^|/)\\.git/|(^|/)\\.overdrive/|overdrive-.*\\.tgz|SOCIAL_POSTS\\.md"; then
  echo "Unexpected file found"
  exit 1
fi
```

Expected result: no matches from the inspection command.

## Release Checklist

For a new release, replace `vX.Y.Z` with the package version in `package.json`:

Treat `README.md` as a required release artifact, not static background material. Every release should update the README when skills, workflow capabilities, install behavior, positioning, compatibility, or safety boundaries change.

For v1 launch, rename or create the public GitHub repo at `radustefandumitru/overdrive` and create the matching tag/release before promoting `npx github:radustefandumitru/overdrive` commands or relying on `overdrive check-updates`.

```bash
git tag vX.Y.Z
git push origin vX.Y.Z
gh release create vX.Y.Z ../Overdrive.zip --title "Overdrive vX.Y.Z" --notes-file CHANGELOG.md
gh repo edit radustefandumitru/overdrive --add-topic claude-code --add-topic codex --add-topic agent-skills --add-topic mcp --add-topic cursor --add-topic gemini-cli --add-topic ai-coding-agents
```

## Attribution Notes

Keep `THIRD_PARTY_NOTICES.md`, source links in `SKILLS_SUMMARY.md`, and creator credits in social/public posts.

For the local public-safe skills:

- Fluid Animations is based on Apple's WWDC 2018 fluid interface guidance, paraphrased for coding agents.
- Emil Animation Polish is based on Emil Kowalski's public writing and animation lessons, paraphrased and attributed.
- Jack Roberts inspired website skills are based on the user-provided public video/resource workflow, paraphrased and attributed. They do not redistribute raw resource downloads.
- Clarify And Plan, Planning First, What Should I Consider, Media Download, and Pre-Launch Checklist are original Overdrive workflow skills, with the global planning guidance inspired by Karpathy-style coding-agent principles and the media workflow pointing users to install yt-dlp themselves.
- Security Review is adapted from Anthropic's MIT-licensed `anthropics/claude-code-security-review` template for non-Claude runtimes.
- Karpathy-inspired global guidance is adapted behavior guidance, not a claim of authorship over Andrej Karpathy's writing or the `multica-ai/andrej-karpathy-skills` repo.
