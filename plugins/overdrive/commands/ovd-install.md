---
description: Install the full Overdrive CLI skill system safely
argument-hint: "[install options]"
---

Explain the Overdrive install choices briefly, then recommend a dry run first.

Use:

```bash
npx -y github:radustefandumitru/overdrive -- --dry-run
```

Then, if the user confirms:

```bash
npx -y github:radustefandumitru/overdrive
```

Do not request or print secrets. Tell the user Overdrive preserves unmarked existing skill folders by default.
