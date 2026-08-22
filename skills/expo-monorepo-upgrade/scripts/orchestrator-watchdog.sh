#!/usr/bin/env bash
# Watchdog for a herdr pane orchestrator: auto-resumes one that stalls mid-run.
#
# A pane orchestrator never ends a turn with a worker in flight, because nothing wakes a
# sleeping pane (references/dispatch-backends.md). A dropped turn — an API outage, an early
# turn end — therefore stalls the whole run silently. This watchdog watches for exactly that
# shape (agent idle, no completion marker) and types a resume into the pane.
#
# Usage: orchestrator-watchdog.sh <agent-name> <pane-id> <done-marker-file> <report-file>
#   <agent-name>        herdr agent id the orchestrator runs as
#   <pane-id>           its pane, where the resume text is typed
#   <done-marker-file>  a file whose existence means this run finished, e.g. reports/<run-id>/summary.md
#   <report-file>       the run's rendered report, e.g. reports/<run-id>/report.html
#
# Arm it beside the orchestrator, backgrounded, from the repo root:
#   skills/expo-monorepo-upgrade/scripts/orchestrator-watchdog.sh orch-1 wD:p1 \
#     reports/<run-id>/summary.md reports/<run-id>/report.html &
#
# Emits one line per action (stall detected / resumed / finished / agent gone); silent otherwise.
# Resumes are capped at 6: past that the stall is not a dropped turn and a human is needed.
set -u
AGENT="$1"; PANE="$2"; DONE_FILE="$3"; REPORT_FILE="$4"
RESUME_MSG="Resume. The watchdog found you idle mid-run with no completion marker — most likely a dropped turn (network outage or an early turn end). Your context is intact: continue under expo-monorepo-upgrade's standing rules — read the ledger for current truth, rule any worker the ledger shows in flight died-versus-running on evidence and rejoin an alive-idle one rather than re-dispatching it, journal this auto-resume, and hold the run in-turn with a heartbeat per wait stretch."
status() { herdr agent get "$AGENT" 2>/dev/null | python3 -c "import json,sys
try: print(json.load(sys.stdin)['result']['agent']['agent_status'])
except Exception: print('gone')" 2>/dev/null || echo gone; }
finished() {
  [ -f "$DONE_FILE" ] && return 0
  [ -f "$REPORT_FILE" ] && return 0
  # Run-close banners: a completed or declined run.
  herdr agent read "$AGENT" --source recent-unwrapped --lines 40 2>/dev/null \
    | grep -qE "ORCHESTRATION: (COMPLETE|DECLINED)" && return 0
  return 1
}
RESUMES=0
while true; do
  sleep 75
  ST=$(status)
  if [ "$ST" = "gone" ]; then echo "watchdog: agent $AGENT gone — exiting"; exit 0; fi
  if [ "$ST" = "idle" ]; then
    if finished; then echo "watchdog: run finished (completion marker) — exiting"; exit 0; fi
    sleep 30                      # confirm it is a stall, not between-turns breathing
    [ "$(status)" = "idle" ] || continue
    finished && { echo "watchdog: run finished — exiting"; exit 0; }
    RESUMES=$((RESUMES+1))
    if [ "$RESUMES" -gt 6 ]; then echo "watchdog: 6 auto-resumes exhausted — human needed"; exit 1; fi
    herdr pane send-text "$PANE" "$RESUME_MSG" >/dev/null 2>&1
    sleep 1
    herdr pane send-keys "$PANE" Enter >/dev/null 2>&1
    sleep 8
    if herdr agent read "$AGENT" --source recent-unwrapped --lines 8 2>/dev/null | grep -q "watchdog found you idle"; then
      echo "watchdog: auto-resume #$RESUMES sent to $AGENT and confirmed landed"
    else
      echo "watchdog: auto-resume #$RESUMES sent to $AGENT (landing unconfirmed)"
    fi
  fi
done
