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
- A repository or database task may use a connector if the recipient has configured one, but the public kit should not assume which connector or project exists.

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
