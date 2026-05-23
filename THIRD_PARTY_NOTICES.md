# Third-Party Notices

This setup is a curated installer/router. Most skills are created by other people and projects. Please support the original repositories.

## License Notes

License detection below is based on GitHub repository metadata checked during kit preparation. Review upstream licenses before public redistribution, especially if publishing bundled copies of third-party skills.

| Source | Repository | Detected license | Notes |
|---|---|---|---|
| Taste Skill | https://github.com/Leonxlnx/taste-skill | MIT | Installed from approved upstream paths |
| Impeccable | https://github.com/pbakaus/impeccable | Apache-2.0 | Installed from approved upstream path |
| Emil Kowalski skill | https://github.com/emilkowalski/skill | No GitHub license detected | Review before public redistribution of bundled copy |
| GSD / get-shit-done | https://github.com/gsd-build/get-shit-done | MIT | Installed/updated through the official `get-shit-done-cc` npm installer, pinned by default in `VERIFIED_SOURCES.md` |
| Agent Skills for Context Engineering | https://github.com/muratcankoylan/Agent-Skills-for-Context-Engineering | MIT | Installed from approved upstream paths |
| MarketingSkills | https://github.com/coreyhaines31/marketingskills | MIT | Installed from approved upstream paths |
| Stop Slop | https://github.com/hardikpandya/stop-slop | MIT | Installed from approved upstream path |
| Banana Claude | https://github.com/AgriciDaniel/banana-claude | MIT | Installed from approved upstream path |
| Obsidian Skills | https://github.com/kepano/obsidian-skills | MIT | Installed from approved upstream paths |
| Composio Awesome Claude Skills | https://github.com/ComposioHQ/awesome-claude-skills | No GitHub license detected | Only curated subset installed; review before public redistribution |
| Remotion Skills | https://github.com/remotion-dev/skills | No GitHub license detected | Installed from approved upstream path; review before public redistribution |
| Playwright CLI | https://github.com/microsoft/playwright-cli | Apache-2.0 | Installed/updated through the official `@playwright/cli` skill installer, pinned by default in `VERIFIED_SOURCES.md` |
| Google Modern Web Guidance | https://github.com/GoogleChrome/modern-web-guidance | Apache-2.0 | Installed from approved upstream paths |
| skills.sh | https://skills.sh | Website/service, reference only | Credited as a discovery helper for finding additional skills; no skills.sh content is vendored in this repo. |
| Apple Developer "Designing Fluid Interfaces" | https://developer.apple.com/videos/play/wwdc2018/803/ | Apple content, reference only | The local `fluid-animations` skill uses public-safe paraphrased implementation guidance and source attribution. Do not redistribute Apple transcripts, slides, or video assets in public bundles without reviewing Apple's terms. |
| Emil Kowalski animation and taste references | https://animations.dev/learn/animation-theory/the-easing-blueprint, https://animations.dev/learn/css-animations/transitions, https://emilkowal.ski/ui/developing-taste, https://emilkowal.ski/ui/7-practical-animation-tips | Website/course content, reference only | The local `emil-animation-polish` skill uses public-safe paraphrased implementation guidance and source attribution. Do not redistribute Emil's course text, videos, interactive examples, or assets in public bundles without reviewing the site's terms. |
| Jack Roberts premium 3D website workflow | https://www.youtube.com/watch?v=TZUTe7s11-I and https://www.skool.com/aiautomationsbyjack/about?ref=d4618abaabee44c7ac3c146938a72100&el=youtube_description_paid | Video/resources/community content, reference only | The local `jack-*` skills use public-safe paraphrased workflow guidance and source attribution. Do not redistribute Jack's raw PDFs, zips, templates, prompts, downloaded skill files, course material, or private community content without reviewing redistribution rights. |
| Karpathy-inspired Claude Code Guidelines | https://github.com/multica-ai/andrej-karpathy-skills | MIT declared in plugin/skill metadata | The local global instruction templates are adapted from this guidance and credit the source. Review upstream if redistributing exact upstream files. |

## Public Sharing Guidance

For a public GitHub repo, the safest approach is to publish the installer, manifest, router, docs, and attribution, and let the installer pull third-party skills from their upstream repositories or official npm installers.

If you publish or broadly share `bundled/skills`, make sure you are comfortable redistributing those files and preserving any required license notices. A private zip shared with a close teammate is lower risk than a public repo that republishes every bundled skill, but it is still third-party redistribution.
