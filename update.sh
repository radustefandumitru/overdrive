#!/usr/bin/env bash
set -euo pipefail

KIT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

show_help() {
  cat <<'EOF'
AgenticSupercharge updater

Default:
  ./update.sh
    1. Pulls the latest AgenticSupercharge repo version when run from a git clone.
    2. Updates AgenticSupercharge-managed skills from verified pinned sources.
    3. Runs verify.sh.

Options:
  --all-skills                 Refresh all matching skills from verified pinned sources using backup-and-replace.
  --managed-only               Default. Update only AgenticSupercharge-managed skills.
  --kit-only                   Update this AgenticSupercharge repo/package only.
  --skills-only                Update installed skills only; skip git self-update.
  --dry-run                    Preview without writing files.
  --no-verify                  Skip verify.sh after updating skills.
  --allow-upstream-drift       Use tracking refs/latest packages instead of verified pins.
  --allow-dirty-self-update    Allow git pull even if this repo has uncommitted changes.

Manual check:
  ./check-updates.sh
    Reports whether a newer kit release or upstream tracking ref is available without applying changes.

Any other options are passed through to the skills updater, for example:
  ./update.sh --all-skills --tools claude,codex
  ./update.sh --skills-only --scope local --project-dir .
EOF
}

if ! command -v node >/dev/null 2>&1; then
  echo "node is required. Install Node.js 18+ and rerun this script." >&2
  exit 1
fi

ALL_SKILLS=0
SKIP_KIT=0
SKIP_SKILLS=0
RUN_VERIFY=1
DRY_RUN=0
SELF_ARGS=()
SKILL_ARGS=()

while [[ $# -gt 0 ]]; do
  case "$1" in
    --help|-h)
      show_help
      exit 0
      ;;
    --all-skills)
      ALL_SKILLS=1
      ;;
    --managed-only)
      ALL_SKILLS=0
      ;;
    --kit-only)
      SKIP_SKILLS=1
      ;;
    --skills-only)
      SKIP_KIT=1
      ;;
    --no-verify)
      RUN_VERIFY=0
      ;;
    --dry-run)
      DRY_RUN=1
      SELF_ARGS+=("$1")
      SKILL_ARGS+=("$1")
      ;;
    --allow-dirty-self-update)
      SELF_ARGS+=("$1")
      ;;
    *)
      SKILL_ARGS+=("$1")
      ;;
  esac
  shift
done

if [[ "$SKIP_KIT" -eq 0 && "$DRY_RUN" -eq 0 && -t 0 && -t 1 ]]; then
  set +e
  CHECK_OUTPUT="$(AGENTIC_SUPERCHARGE_KIT_DIR="$KIT_DIR" node "$KIT_DIR/bin/agentic-supercharge.js" check-updates 2>/dev/null)"
  CHECK_STATUS=$?
  set -e
  if [[ "$CHECK_STATUS" -eq 1 && "$CHECK_OUTPUT" == *"A newer AgenticSupercharge version is available"* ]]; then
    echo "$CHECK_OUTPUT"
    read -r -p "Apply now? [y/N] " APPLY_NOW
    case "$APPLY_NOW" in
      y|Y|yes|YES)
        ;;
      *)
        echo "No changes made."
        exit 0
        ;;
    esac
    echo
  elif [[ "$CHECK_STATUS" -eq 1 ]]; then
    echo "$CHECK_OUTPUT"
    echo
  fi
fi

if [[ "$SKIP_KIT" -eq 0 ]]; then
  echo "Updating AgenticSupercharge itself..."
  AGENTIC_SUPERCHARGE_KIT_DIR="$KIT_DIR" node "$KIT_DIR/bin/agentic-supercharge.js" self-update "${SELF_ARGS[@]}"
  echo
fi

if [[ "$SKIP_SKILLS" -eq 0 ]]; then
  if [[ "$ALL_SKILLS" -eq 1 ]]; then
    echo "Updating all matching skills from verified pinned sources with timestamped backups..."
    AGENTIC_SUPERCHARGE_KIT_DIR="$KIT_DIR" node "$KIT_DIR/bin/agentic-supercharge.js" update-skills --all-skills "${SKILL_ARGS[@]}"
  else
    echo "Updating AgenticSupercharge-managed skills from verified pinned sources..."
    AGENTIC_SUPERCHARGE_KIT_DIR="$KIT_DIR" node "$KIT_DIR/bin/agentic-supercharge.js" update-skills "${SKILL_ARGS[@]}"
  fi
  echo
fi

if [[ "$RUN_VERIFY" -eq 1 && "$DRY_RUN" -eq 0 && "$SKIP_SKILLS" -eq 0 ]]; then
  echo "Verifying installation..."
  "$KIT_DIR/verify.sh"
  echo
fi

if [[ "$DRY_RUN" -eq 1 ]]; then
  echo "Dry run complete. No files were changed."
else
  echo "Update complete. Restart your coding agents so they re-index skills."
fi
