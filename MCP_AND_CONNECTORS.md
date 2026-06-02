# Context7 And Connector Guidance

This kit standardizes one MCP recommendation: use Context7 for current documentation lookup. It does not prescribe repository, database, or account-specific MCP setups because those vary by user and project.

Do not commit, zip, paste, screenshot, or publish API keys, OAuth tokens, MCP secrets, service-role keys, database URLs, browser profiles, or personal app-session files.

## Recommended Defaults

| Tool | Use for | Notes |
|---|---|---|
| Context7 MCP | Current documentation for libraries, frameworks, SDKs, APIs, CLIs, cloud services, setup, configuration, migrations, and version-specific code | Prefer this over memory when available. It is usually read-only documentation lookup. |
| Other MCPs/connectors | Repository, database, browser, app, or account-specific workflows | Not prescribed by this public kit. Configure only what your own runtime and projects need. |

## How This Relates To Skills

Skills decide the workflow or expertise to load. MCPs and connectors are tools the agent may use after choosing the workflow.

Examples:

- A React setup issue may route through `modern-web-guidance`, then use Context7 for current React/Next.js/library docs.
- A frontend polish task may use `design-taste-frontend`, `emil-design-eng`, `emil-animation-polish`, or `fluid-animations`, then use whatever browser validation tool the recipient has configured.
- A Jack Roberts style 3D website workflow may use `jack-premium-site-system`, `jack-website-intelligence`, `jack-scroll-asset-prompts`, `jack-scroll-3d-sites`, or `jack-seo-launch-audit`. Firecrawl, GitHub, Vercel, image/video generation services, and browser connectors are optional personal/project tools, not required public kit assumptions.
- `design-extract` may mention designlang, browser tooling, and optional Design Extract ecosystem surfaces. AgenticSupercharge may attempt browser support only; it does not prescribe or install optional MCP/config surfaces, extensions, cookies, or account state. Agents should check local availability and fall back to screenshots/source inspection when unavailable.
- A repository or database task may use a connector if the recipient has configured one, but the public kit should not assume which connector or project exists.

## Recommended Optional MCPs

These are not installed or required by AgenticSupercharge. Add them only when your own runtime, accounts, and permissions make sense. Keep tokens in environment variables or the host's secure auth flow, never in a repo.

| Optional MCP | Good for | Example config | Auth needed | Agents |
|---|---|---|---|---|
| GitHub MCP | Repository search, issues, PRs, Actions, releases, Dependabot/code-security context, and repo operations. | Remote server hosts can point to `https://api.githubcopilot.com/mcp/`. Local Docker fallback: `{"mcpServers":{"github":{"command":"docker","args":["run","-i","--rm","-e","GITHUB_PERSONAL_ACCESS_TOKEN","ghcr.io/github/github-mcp-server"],"env":{"GITHUB_PERSONAL_ACCESS_TOKEN":"${GITHUB_PERSONAL_ACCESS_TOKEN}","GITHUB_READ_ONLY":"1"}}}}` | GitHub OAuth for supported remote hosts, or a PAT in `GITHUB_PERSONAL_ACCESS_TOKEN` for local Docker. Prefer read-only/toolset scoping first. | Claude Code, Cursor, VS Code/Copilot, and other remote/local MCP-capable hosts; support varies by host. |
| Supabase MCP | Development database inspection, migrations, logs, advisors, edge functions, project URL/keys, and generated types. | Hosted remote: `{"mcpServers":{"supabase":{"type":"http","url":"https://mcp.supabase.com/mcp"}}}`. Claude Code project command: `claude mcp add --scope project --transport http supabase "https://mcp.supabase.com/mcp"` | Browser OAuth for hosted MCP when supported; PAT/header-based auth only for CI or unsupported clients. Do not connect this to production data without a deliberate safety review. | Claude Code and other HTTP MCP-capable clients; host support varies. |
| Vercel MCP | Vercel project/account MCP access and deployed MCP server connection setup. | CLI setup: `vercel mcp` for global account config or `vercel mcp --project` for a linked project. Remote hosted Vercel MCP can also be added with `npx add-mcp https://mcp.vercel.com` where supported. | Vercel login or `VERCEL_TOKEN` if using CLI automation. Scope tokens narrowly. | Vercel CLI-supported MCP clients; Cursor/Codex/Claude support depends on host config. |
| Firecrawl MCP | Website scraping, crawl-to-markdown, brand/site extraction, and research workflows. | Local stdio example: `{"mcpServers":{"firecrawl":{"command":"npx","args":["-y","firecrawl-mcp"],"env":{"FIRECRAWL_API_KEY":"${FIRECRAWL_API_KEY}"}}}}` | Firecrawl API key in `FIRECRAWL_API_KEY`. | Local MCP-capable hosts such as Claude Code, Cursor, Codex, Gemini/Antigravity where configured. |
| Playwright MCP | Browser operation through an MCP server: screenshots, navigation, forms, debugging, and browser context control. | Headless stdio example: `{"mcpServers":{"playwright":{"command":"npx","args":["@playwright/mcp@latest","--headless"]}}}`. Standalone HTTP: run `npx @playwright/mcp@latest --port 8931`, then configure `{"mcpServers":{"playwright":{"url":"http://localhost:8931/mcp"}}}`. | Usually no account auth; requires Node and browsers. | Local MCP-capable hosts. AgenticSupercharge already includes `playwright-cli`, so this is optional extra browser tooling. |
| MarkItDown MCP | Document-to-Markdown conversion for local/hosted files when the user's runtime supports MarkItDown MCP. | Microsoft MarkItDown includes `markitdown-mcp`. Prefer local CLI conversion through `convert-to-markdown` unless the user deliberately configures the MCP server. | No account auth by default, but it can read files provided to the host; treat converted document content as sensitive. | Optional for MCP-capable hosts; not installed, prescribed, or auto-configured by AgenticSupercharge. |
| Browserbase | Hosted browser automation, browser QA, company/research workflows, and optional Browserbase skills for users with an account. | See `https://github.com/browserbase/skills`. Users supply their own Browserbase account/API key and choose which Browserbase tools/skills to install. | Browserbase account/API key, often paid. Do not store keys in this repo or AgenticSupercharge docs. | Optional only; not bundled, not prescribed, not auto-configured. |

References: GitHub MCP server docs, Supabase MCP docs, Vercel MCP docs, Firecrawl MCP docs, and Playwright MCP docs should be checked before copying a snippet into a real project because host config formats change.

## Recommended Optional External Tools

AgenticSupercharge v0.11 may attempt setup for the narrow helper set used directly by bundled skills: `graphifyy==0.1.14`, `yt-dlp`, `ffmpeg`, and browser support for `design-extract`. These attempts are non-privileged, fail open, and can be skipped with `--no-tool-install`. Everything below that involves accounts, MCP servers, app sessions, or secrets remains user-configured.

| Tool | Good for | Setup note |
|---|---|---|
| Superwhisper | High-quality system-wide dictation into any coding-agent text field. | Paid macOS app; grant microphone permissions in System Settings. |
| Spokenly | Voice dictation with useful Claude Code integration options. | Paid app; optional MCP features depend on the user's own setup. |
| Whisper Dictation | Local/system dictation workflow for users who prefer Whisper-backed transcription. | May require local model download and mic permissions. |
| VoiceMode + local Whisper | Free DIY voice pipeline. | Requires Python, ffmpeg, a local Whisper model, and more manual setup; not part of the default installer. |
| Obsidian | Deeper vault automation beyond the bundled `json-canvas` and `defuddle` skills. | AgenticSupercharge v0.5 keeps Obsidian support intentionally light; users who need full vault CLI/Bases/Markdown automation should add their preferred Obsidian tooling locally and keep vaults backed up. |
| Defuddle | Clean web-page-to-markdown extraction for notes and research. | The `defuddle` skill enhances extraction when the CLI is available and falls back gracefully to normal web fetch/browser workflows when it is not. |
| yt-dlp | User-requested media downloads, MP3 extraction, and high-quality MP4 downloads through the bundled `media-download` skill. | Installer attempts safe setup when `media-download` or `claude-video` is selected; otherwise install manually, such as `brew install yt-dlp` on macOS. Respect platform terms and permissions. |
| MarkItDown | Local file-to-Markdown conversion used by `convert-to-markdown` and AS-Workflow knowledge-vault caching when available. | Install with `python3 -m pip install 'markitdown[all]'` when PDF/Office/spreadsheet conversion is needed. |
| designlang / Design Extract | Public website design-language extraction for colors, fonts, spacing, components, Tailwind/shadcn themes, and handoff files. | Installer checks for system Chrome/Chromium/Edge and may attempt Playwright Chromium only if no system browser exists. It does not install extensions, MCP configs, cookies, or auth state. |
| ffmpeg / ffprobe | Frame extraction and video inspection for `claude-video`. | Installer attempts safe setup through Homebrew or winget where available. Linux remains manual unless a non-sudo path is already available. The skill continues frames-only/captions-only when setup fails. |

## Security Review Integration

For deep security review on real PRs, consider Anthropic's official `anthropics/claude-code-security-review` GitHub Action and ClaudeDevs security-guidance material where available in Claude Code. The portable `security-review` skill in this kit is for non-Claude agents and local in-IDE review. These are complementary: Claude-only hook/CI tooling can provide diff-aware PR comments, while the portable skill keeps a baseline review workflow available in Codex, Gemini, Antigravity, Cursor, and shared `.agents`.

## Sharing Rule

When sharing this setup publicly or with friends, share:

- `MCP_AND_CONNECTORS.md`
- `global-instructions/`
- `skills/`
- `manifest.json`
- installer and verification scripts

Do not share:

- runtime config files that contain tokens
- local auth/session folders
- `.env` files
- browser profiles
- service-role keys
- personal connector state
