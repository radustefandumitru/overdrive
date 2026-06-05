Run:

```bash
overdrive check-updates
```

If updates are available and the user confirms, recommend:

```bash
overdrive update-skills
```

For a cloned repo, recommend `./update.sh` from the repository root. Keep the distinction clear: verified pinned updates are the default; live upstream drift requires explicit `--allow-upstream-drift`.
