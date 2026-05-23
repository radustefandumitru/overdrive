# Publishing AgenticSupercharge

This kit is designed to be published as a public GitHub repo and installed from clone, zip, or GitHub `npx`.

Public repo:

[radustefandumitru/AgenticSupercharge](https://github.com/radustefandumitru/AgenticSupercharge)

## Public-Safe Shape

Publish the installer, manifest, local AgenticSupercharge skills, global instruction templates, docs, and source notices.

Do not publish:

- `bundled/skills` unless every upstream license has been reviewed and redistribution is allowed.
- API keys, OAuth tokens, MCP configs with credentials, service-role keys, database URLs, browser profiles, cookies, or app sessions.
- Jack Roberts raw PDFs, zips, templates, downloaded folders, prompts, private community/course material, or copied third-party skill text.
- Personal account state for GitHub, Vercel, Supabase, Firecrawl, Google, Claude, Codex, Gemini, Antigravity, Cursor, or any other service.
- Cursor's built-in `~/.cursor/skills-cursor` content.

The public framing should be:

- AgenticSupercharge is a curated installer and router.
- Original creators keep credit for their work.
- The installer pulls approved sources from upstream repos or official installers.
- Local skills authored for this kit are paraphrased, attributed, and public-safe.
- Context7 guidance is included as the public-standard MCP recommendation.
- Other MCPs/connectors are intentionally left to each user's own runtime and projects.

## Publish Commands

From `/Users/stefan/Desktop/Codex Skills Setup/ai-skill-setup`:

```bash
git init
git add .
git commit -m "Initial AgenticSupercharge installer"
git branch -M main
git remote add origin https://github.com/radustefandumitru/AgenticSupercharge.git
git push -u origin main
```

If a remote already exists:

```bash
git remote -v
git remote set-url origin https://github.com/radustefandumitru/AgenticSupercharge.git
git push -u origin main
```

Before pushing, run:

```bash
bash -n install.sh verify.sh update.sh
node --check lib/installer.js
node --check bin/agentic-supercharge.js
./install.sh --dry-run
./install.sh --list-targets
npm pack --dry-run
```

## Install Commands For Users

Clone:

```bash
git clone https://github.com/radustefandumitru/AgenticSupercharge.git
cd AgenticSupercharge
./install.sh
```

Safe preview:

```bash
./install.sh --dry-run
```

GitHub `npx`:

```bash
npx -y github:radustefandumitru/AgenticSupercharge -- --dry-run
npx -y github:radustefandumitru/AgenticSupercharge
```

Zip:

```bash
unzip AgenticSupercharge.zip
cd AgenticSupercharge
./install.sh
```

## Power User Examples

Global auto-detection with safe defaults:

```bash
./install.sh --scope global --tools auto --conflict preserve
```

Global manual target install:

```bash
./install.sh --scope global --tools cursor,codex --conflict backup-and-replace
```

Local project install:

```bash
./install.sh --scope local --project-dir . --conflict preserve
```

Update previously managed skill folders only:

```bash
./update.sh
```

## Zip Builds

Public zip:

```bash
cd "/Users/stefan/Desktop/Codex Skills Setup"
zip -r ai-skill-setup-public.zip ai-skill-setup \
  -x 'ai-skill-setup/bundled/skills/*' \
  -x 'ai-skill-setup/.git/*' \
  -x 'ai-skill-setup/.DS_Store' \
  -x 'ai-skill-setup/**/.DS_Store' \
  -x 'ai-skill-setup/agentic-supercharge-*.tgz' \
  -x 'ai-skill-setup/sources.lock.json'
```

Private/offline zip:

```bash
cd "/Users/stefan/Desktop/Codex Skills Setup"
zip -r ai-skill-setup.zip ai-skill-setup \
  -x 'ai-skill-setup/.git/*' \
  -x 'ai-skill-setup/.DS_Store' \
  -x 'ai-skill-setup/**/.DS_Store' \
  -x 'ai-skill-setup/agentic-supercharge-*.tgz' \
  -x 'ai-skill-setup/sources.lock.json'
```

## Attribution Notes

Keep `THIRD_PARTY_NOTICES.md`, source links in `SKILLS_SUMMARY.md`, and creator credits in social/public posts.

For the local public-safe skills:

- Fluid Animations is based on Apple's WWDC 2018 fluid interface guidance, paraphrased for coding agents.
- Emil Animation Polish is based on Emil Kowalski's public writing and animation lessons, paraphrased and attributed.
- Jack Roberts inspired website skills are based on the user-provided public video/resource workflow, paraphrased and attributed. They do not redistribute raw resource downloads.
- Karpathy-inspired global guidance is adapted behavior guidance, not a claim of authorship over Andrej Karpathy's writing or the `multica-ai/andrej-karpathy-skills` repo.
