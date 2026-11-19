# Overdrive v2.0.3

You can now pause Overdrive in one project and keep it running everywhere else.

```bash
ovd workflow disable
ovd status
ovd workflow enable
```

- The opt-out is stored in the project's local, gitignored `.overdrive/config.json`. It doesn't delete project state, uninstall skills, or affect teammates' checkouts.
- A Git checkout's opt-out also applies to its workspace packages, while separately nested repositories keep their own setting.
- While disabled, Overdrive skips automatic routing, workflow hooks that update state, and planning or logging commands. You can still request individual skills.
- `ovd status` and `ovd doctor` show why the workflow is off. `OVERDRIVE_WORKFLOW=disabled` still takes precedence over the project setting.

Existing projects stay enabled unless you opt out. The skill catalog is unchanged.

This release also requires `js-yaml` 4.3.2 or later within the 4.x series to address two denial-of-service advisories ([GHSA-5p4m-2wfm-xmqj](https://github.com/advisories/GHSA-5p4m-2wfm-xmqj), [GHSA-2883-xcg3-v3hh](https://github.com/advisories/GHSA-2883-xcg3-v3hh)). Clone and ZIP installs refresh an outdated copy before use.
