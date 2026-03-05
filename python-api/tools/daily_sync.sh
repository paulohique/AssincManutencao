#!/usr/bin/env bash
set -euo pipefail

# Runs GLPI -> DB sync once and writes a timestamped log.
# Intended for scheduling (cron / Windows Task Scheduler calling WSL).

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
PYTHON_API_DIR="$(cd -- "$SCRIPT_DIR/.." && pwd)"
REPO_ROOT="$(cd -- "$PYTHON_API_DIR/.." && pwd)"

LOG_DIR="$PYTHON_API_DIR/logs"
mkdir -p "$LOG_DIR"

STAMP="$(date +"%Y-%m-%d_%H-%M-%S")"
LOG_FILE="$LOG_DIR/sync_$STAMP.log"

PY="$PYTHON_API_DIR/venv/bin/python"
if [[ ! -x "$PY" ]]; then
  if command -v python3 >/dev/null 2>&1; then
    PY="$(command -v python3)"
  else
    PY="$(command -v python)"
  fi
fi

echo "[$(date -Is)] Starting GLPI sync" | tee -a "$LOG_FILE"
cd "$REPO_ROOT"

"$PY" "$PYTHON_API_DIR/tools/run_sync.py" >>"$LOG_FILE" 2>&1
EXIT_CODE=$?

echo "[$(date -Is)] Finished GLPI sync (exit=$EXIT_CODE)" | tee -a "$LOG_FILE"
exit "$EXIT_CODE"
