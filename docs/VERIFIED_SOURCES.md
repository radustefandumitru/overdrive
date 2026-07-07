# Verified Sources

These are the upstream refs and package versions verified for this release. Default installs use the pinned value. Use `--allow-upstream-drift` only when you intentionally want the tracking branch or latest package instead.

Verified on: 2026-07-07

| Source | Type | Pinned value | Tracking value | Upstream |
|---|---|---|---|---|
| Taste Skill | Git | `339afcbf575daeaa61ee89646b3ba8912b308c39` | `main` | https://github.com/Leonxlnx/taste-skill |
| Impeccable by Paul Bakaus / @pbakaus | Git | `4af581e23f17d112d8f9d6b7a5b7ff37823494e1` (`skill-v3.1.1`) | `main` | https://github.com/pbakaus/impeccable |
| React Doctor by Million / Aiden Bai / @aidenybai | Git | `6d53182f7333b29d5168dcd311c1d5f18e95e072` | `main` | https://github.com/millionco/react-doctor |
| Emil Kowalski skill | Git | `ecf66bbd1fb33c25332b6b0e454d08049978284c` | `main` | https://github.com/emilkowalski/skill |
| Modern Web Guidance | Git | `65d7f20ac85517a362107ce89b7be7f905105fd3` | `main` | https://github.com/GoogleChrome/modern-web-guidance |
| Remotion Skills | Git | `277510e78245ac0fa275d7cb6520d52e0ac2e212` | `main` | https://github.com/remotion-dev/skills |
| Agent Skills for Context Engineering | Git | `61f38ffc0ff3ae83adcf2fe011f3b751105add6d` | `main` | https://github.com/muratcankoylan/Agent-Skills-for-Context-Engineering |
| MarketingSkills | Git | `0f39e12b76457c3463a7eba1d22c658de5886b8b` | `main` | https://github.com/coreyhaines31/marketingskills |
| Stop Slop | Git | `8da1f030185bdfe8471220585162991eaeb970e9` | `main` | https://github.com/hardikpandya/stop-slop |
| Banana Claude | Git | `a4b5a7e4f592029886a379496cf29980fb6b8824` | `main` | https://github.com/AgriciDaniel/banana-claude |
| Obsidian Skills | Git | `553ef99aa3306dd23f268e1ba9af752577684f69` | `main` | https://github.com/kepano/obsidian-skills |
| Last30Days skill | Git | `1e03af19e0ad435ee6d227a3593b0c6e5d2ecbe8` | `main` | https://github.com/mvanhorn/last30days-skill |
| App Onboarding Questionnaire | Git | `5bc4786d80f2c23de60b3ba02773e919ed8fd091` | `main` | https://github.com/adamlyttleapps/claude-skill-app-onboarding-questionnaire |
| Layers of Product Design by Jamie Mill / @jamiemill | Git | `64b9202bf0506ad1418b9975681c95798725e25a` | `main` | https://github.com/jamiemill/layers-skills |
| Graphify by Safi Shamsi | Git | `91f4d120b630ee35c79bf3c75ccd186870a808f9` | `main` | https://github.com/safishamsi/graphify |
| Claude Video by Brad Bonanno / @bradautomates | Git | `c333c2289e57bf040b32846f18d669e3f8edad9b` | `main` | https://github.com/bradautomates/claude-video |
| Humanizer by Siqi Chen / @blader | Git | `a2ace14a88a6746f64f1f53ed8272d6788828038` | `main` | https://github.com/blader/humanizer |
| Prompt Master by Nidhin J S / @nidhinjs | Git | `7a02ddd31bad3056cc3ccf0af2b23d7b30d4abc2` | `main` | https://github.com/nidhinjs/prompt-master |
| Anthropic example skills | Git | `690f15cac7f7b4c055c5ab109c79ed9259934081` | `main` | https://github.com/anthropics/skills |
| OpenAI Skills Catalog | Git | `b0401f07213a66414d84a65cb50c1d226f99485a` | `main` | https://github.com/openai/skills |
| Vercel Labs Skills | Git | `e4243fbf7d9398722024f62850ece90fa0d5c693` | `main` | https://github.com/vercel-labs/skills |
| Composio Awesome Claude Skills | Git | `92568c1edaff1bde5371154f036d959346c145a8` | `master` | https://github.com/ComposioHQ/awesome-claude-skills |
| Playwright CLI installer | npm | `@playwright/cli@0.1.13` | `@playwright/cli@latest` | https://github.com/microsoft/playwright-cli |

## Runtime Dependencies

These are npm dependencies used by Overdrive itself, not installed skills.

| Package | Use | Version policy | Upstream |
|---|---|---|---|
| js-yaml | Parses and writes `yaml ovd-plan` blocks in `OVERDRIVE.md` | `^4.1.0` in `package.json`; installed by npm/npx or the local dependency preflight for clone/zip users | https://github.com/nodeca/js-yaml |

## Optional Helper Tooling

These are not vendored skill sources. v0.11 may invoke them on the user's machine during safe, non-privileged optional setup unless `--no-tool-install` is set.

| Tool | Use | Version/pin policy | Upstream |
|---|---|---|---|
| graphifyy | Graphify CLI/package setup | `graphifyy==0.1.14` pinned by installer; Python 3.10-3.12 preferred for this dependency tree | https://github.com/safishamsi/graphify |
| pipx | Preferred user-space Python CLI installer | Existing local tool if available | https://github.com/pypa/pipx |
| Homebrew | macOS helper setup for `ffmpeg` / `yt-dlp` | Existing local tool if available | https://github.com/Homebrew/brew |
| Windows Package Manager / winget | Windows helper setup for FFmpeg / yt-dlp | Existing local tool if available | https://github.com/microsoft/winget-cli |
| FFmpeg | Video frame/metadata helper for `claude-video` | Package-manager version; no binaries bundled | https://ffmpeg.org/ |
| yt-dlp | Media/caption helper for `media-download` and `claude-video` | Package-manager or pipx version; no binaries bundled | https://github.com/yt-dlp/yt-dlp |
| Playwright Chromium | Browser fallback for `design-extract` when no system browser exists | Playwright-managed browser download; no browser bundled | https://github.com/microsoft/playwright |

`sources.lock.json` records the exact refs, commits, packages, and install decisions for real local installs. It is intentionally ignored and excluded from public packages.

## Attribution And Provenance Links

The links below are credited sources and provenance references for local skills, folded patterns, and release research. `x.com` links are credit-only and are not install/fetch sources.

| Item | Creator / role | Links |
|---|---|---|
| React Doctor | Aiden Bai / Million / @aidenybai | https://github.com/millionco/react-doctor · https://react.doctor · https://x.com/aidenybai/status/2059303624266977296 |
| Impeccable | Paul Bakaus / @pbakaus | https://github.com/pbakaus/impeccable · https://impeccable.style · https://x.com/pbakaus/status/2060208540992880794 |
| Media Download | yt-dlp project | https://github.com/yt-dlp/yt-dlp |
| Prompt-line principles | Boris Cherny / Anthropic, shared by @AnatoliKopadze | https://x.com/AnatoliKopadze/status/2054568935274549597 · https://x.com/AnatoliKopadze/status/2056362875195686927 |
| Layers of Product Design | Jamie Mill / @jamiemill; recommended by @nurijanian | https://github.com/jamiemill/layers-skills · https://layers.jamiemill.com · https://x.com/nurijanian/status/2058231994329497922 |
| Graphify | Safi Shamsi / @safishamsi | https://github.com/safishamsi/graphify · https://graphify.net |
| Prompt Master | Nidhin J S / @nidhinjs | https://github.com/nidhinjs/prompt-master |
| Humanizer | Siqi Chen / @blader | https://github.com/blader/humanizer |
| Design Extract / designlang inspiration | Manav Arya Singh / @Manavarya09 | https://designlang.manavaryasingh.com |
| Claude Video | Brad Bonanno / @bradautomates | https://github.com/bradautomates/claude-video |
| Pretext | Cheng Lou / @_chenglou | https://github.com/chenglou/pretext · npm `@chenglou/pretext` |
| Usage command inspiration | AgentSeal codeburn; ryoppippi ccusage | https://github.com/getagentseal/codeburn · https://github.com/ryoppippi/ccusage |
| Liquid Glass inspiration | Andrew Prifer / @AndrewPrifer | https://github.com/AndrewPrifer/liquid-dom · https://x.com/AndrewPrifer/status/2056923983581446529 |
| Liquid Glass CSS/SVG technique | kube.io | https://kube.io/blog/liquid-glass-css-svg/ |
| Liquid Glass implementation references | nikdelvin, rizroze, Z1Code, naughtyduk, dashersw | https://github.com/nikdelvin/liquid-glass · https://github.com/rizroze/liquid-glass · https://github.com/Z1Code/glass-refraction · https://github.com/naughtyduk/liquidGL · https://github.com/dashersw/liquid-glass-js |
| Proximity hover | @gabriell_lab and @baptistebriel | https://x.com/gabriell_lab/status/2060336070059864461 · https://x.com/baptistebriel/status/2060351541345681851 |
| CSS scroll-state navbar | @mannupaaji and Chrome team | https://x.com/mannupaaji/status/2060025609867387239 · https://developer.chrome.com/blog/css-scroll-state-queries |
| MarkItDown token pipeline | Microsoft | https://github.com/microsoft/markitdown |
| Browserbase optional connector | Browserbase; amplified by @iam_elias1 | https://github.com/browserbase/skills · https://x.com/iam_elias1/status/2059274512408162520 |
| Reddit research | Reddit public read-only endpoints | public `*.json` endpoints such as subreddit search and comments JSON; no credentials bundled |
| Prompt-caching guidance | Andre Kreidemann; Sankalp Shubham; Sam Rose / ngrok | https://kreidemann.com/blog/prompt-caching · https://sankalp.bearblog.dev/how-prompt-caching-works/ · https://ngrok.com/blog/prompt-caching |
