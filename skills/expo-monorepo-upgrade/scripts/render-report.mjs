#!/usr/bin/env node
// The skill's default reporting template: renders <reports-dir>/<run-id>/report.html from the
// run's JSON data files — report.json + state.json + events.jsonl. Zero dependencies.
//
// One page, one visual system, sections chosen by DATA PRESENCE rather than by page variant:
// clusters and a gate matrix draw the evidence sections; a file
// carrying none of them still renders as a coherent minimal page. Every report this skill produces
// therefore reads as one family, and the JSON is always the source — this script displays what the
// workers wrote and invents no finding of its own.
//
// Run it from the repo root; the id is argv[2] and defaults to the newest run-* directory.
// Usage: node skills/expo-monorepo-upgrade/scripts/render-report.mjs [run-id]
import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const reportsDir = 'reports';
const runId = process.argv[2] ??
  readdirSync(reportsDir).filter(d => d.startsWith('run-')).sort().at(-1);
const dir = join(reportsDir, runId);
const readJson = (p, fallback) => (p && existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : fallback);
const report = readJson(join(dir, 'report.json'), {});
const state  = readJson(join(dir, 'state.json'), {});
const events = existsSync(join(dir, 'events.jsonl'))
  ? readFileSync(join(dir, 'events.jsonl'), 'utf8').trim().split('\n').filter(Boolean).map(JSON.parse)
  : [];

// --- shared helpers --------------------------------------------------------
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const dur = s => s == null ? '—' : s < 90 ? `${Math.round(s)}s` : `${Math.floor(s/60)}m ${String(Math.round(s%60)).padStart(2,'0')}s`;
const plural = (n, one, many = one + 's') => `${n} ${n === 1 ? one : many}`;
const kpi = (label, value, note = '') =>
  `<div class="kpi-card"><div class="kpi-label">${esc(label)}</div><div class="kpi-value">${value}</div>${note ? `<div class="kpi-note">${esc(note)}</div>` : ''}</div>`;
const badge = st => `<span class="pill ${st === 'green' ? 'ok' : st === 'red' ? 'bad' : 'warn'}">${st === 'green' ? '✓' : st === 'red' ? '✗' : '⛔'} ${esc(st)}</span>`;
const section = (title, body) => body ? `<h2>${esc(title)}</h2>\n${body}` : '';

// --- the data this run actually carries ------------------------------------
const o = report.overview ?? {};
const apps = o.apps ?? [], platforms = o.platforms ?? [];
const clusters = report.clusters ?? [];
const decisions = report.decisions ?? [];
const followUps = report.follow_ups ?? [];
const tl = report.timeline ?? [];
const checkpoints = state.checkpoints ?? [], flakes = state.flakes ?? [];
const budgets = state.budgets ?? {};

const roleCounts = {};
for (const e of events) if (e.type === 'dispatched') roleCounts[e.role] = (roleCounts[e.role] ?? 0) + 1;
const phases = [];
for (const e of events) {
  if (e.type === 'phase_started') phases.push({ phase: e.phase, start: e.at, end: null });
  if (e.type === 'phase_closed') { const p = [...phases].reverse().find(p => p.phase === e.phase); if (p) p.end = e.at; }
}
const phaseDur = p => p.end ? (new Date(p.end) - new Date(p.start)) / 1000 : null;
const cells = (map, keep) => {
  const rows = [];
  for (const [app, plats] of Object.entries(map ?? {}))
    for (const [plat, gs] of Object.entries(plats))
      for (const [gate, v] of Object.entries(gs)) {
        const st = typeof v === 'string' ? v : v.status;
        if (keep(st, v)) rows.push({ app, plat, gate, st, cause: typeof v === 'string' ? null : v.cause });
      }
  return rows;
};
const matrixRows = cells(state.matrix, (st, v) => typeof v === 'string');
const baseRows = cells(state.baseline, () => true);
const greens = matrixRows.filter(r => r.st === 'green').length;
const openedClusters = clusters.filter(c => !c.pre_existing).length;
// The committed events are the complete commit record; checkpoints may hold only
// the bump/docs entries on ledgers written before fix commits checkpointed.
const committedEvents = events.filter(e => e.type === 'committed' && e.commit_sha);
const commits = committedEvents.length
  ? committedEvents.map(e => ({ sha: e.commit_sha, label: e.cluster ?? e.phase ?? '',
      description: (checkpoints.find(c => c.commit_sha === e.commit_sha) ?? {}).description }))
  : checkpoints.map(c => ({ sha: c.commit_sha, label: c.phase, description: c.description }));
const fixCommits = commits.filter(c => c.label !== 'bump' && c.label !== 'report').length;
const byPhase = {};
for (const t of tl) (byPhase[t.phase ?? '?'] ??= []).push(t);

// Which kind of page this is, decided by the data alone.
const hasEvidence = matrixRows.length > 0 || clusters.length > 0;

// --- one visual system -----------------------------------------------------
const CSS = `
:root{--bg:#f3f1eb;--surface:#fffdf8;--surface-2:#ebe7de;--border:#d7d0c3;--border-strong:#aaa092;
--text:#17232d;--text-dim:#5d6972;--blue:#123e61;--blue-soft:#dce8f0;--amber:#a85f05;--amber-soft:#fae9c9;
--emerald:#08745f;--emerald-soft:#d7eee7;--red:#a03a35;--red-soft:#f5dfdb;--shadow:0 10px 30px rgba(29,39,47,.08);
--sans:"IBM Plex Sans","Aptos","Segoe UI",sans-serif;--mono:"IBM Plex Mono","SFMono-Regular",Consolas,monospace}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font:16px/1.6 var(--sans)}
.wrap{max-width:1000px;margin:0 auto;padding:40px 24px 80px}
.eyebrow{font:600 12px/1 var(--mono);letter-spacing:.14em;text-transform:uppercase;color:var(--blue)}
h1{font-size:34px;line-height:1.2;margin:10px 0 6px}
.lead{color:var(--text-dim);max-width:64ch}
h2{font-size:20px;margin:44px 0 12px;padding-top:20px;border-top:1px solid var(--border)}
h3{font-size:15px;margin:18px 0 6px}
.kpi-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin:24px 0}
.kpi-card{background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:12px 14px;box-shadow:var(--shadow)}
.kpi-label{font:600 11px/1 var(--mono);letter-spacing:.1em;text-transform:uppercase;color:var(--text-dim)}
.kpi-value{font-size:26px;font-weight:650;margin-top:6px}.kpi-note{font-size:12px;color:var(--text-dim)}
table{width:100%;border-collapse:collapse;background:var(--surface);border:1px solid var(--border);border-radius:10px;overflow:hidden;font-size:14px}
th{font:600 11px/1 var(--mono);letter-spacing:.08em;text-transform:uppercase;color:var(--text-dim);text-align:left;padding:10px 12px;background:var(--surface-2)}
td{padding:8px 12px;border-top:1px solid var(--border)}td.mono,.mono{font-family:var(--mono);font-size:13px}
.pill{display:inline-block;font:600 12px/1.6 var(--mono);border-radius:999px;padding:2px 10px}
.ok{background:var(--emerald-soft);color:var(--emerald)}.bad{background:var(--red-soft);color:var(--red)}
.warn{background:var(--amber-soft);color:var(--amber)}.info{background:var(--blue-soft);color:var(--blue)}
.cluster{background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:14px 16px;margin:10px 0;box-shadow:var(--shadow)}
.cluster .mono{color:var(--text-dim)}
ul{padding-left:20px}li{margin:4px 0}
.timeline{list-style:none;padding:0}.timeline>li{border-left:3px solid var(--blue-soft);margin:0;padding:6px 0 6px 16px}
.timeline b{font-family:var(--mono);font-size:13px}
details{background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:10px 14px;margin:8px 0}
summary{cursor:pointer;font-weight:600}
footer{margin-top:48px;color:var(--text-dim);font:13px var(--mono)}
.chips{display:flex;flex-wrap:wrap;gap:6px}.chips .pill{font-weight:500}
.delta{color:var(--text-dim);font-size:12px}
`;

// --- header ----------------------------------------------------------------
const hasTarget = Boolean(o.to_sdk) && o.to_sdk !== '—';
const targetLabel = hasTarget ? esc(o.to_sdk) : '<target>';
const sdkPair = hasTarget ? `SDK ${esc(o.from_sdk ?? '—')} → ${esc(o.to_sdk)}` : 'an Expo SDK upgrade';
const eyebrow = hasEvidence ? 'evidence report' : 'run report';
const headline = hasEvidence
  ? `${plural(greens, 'gate')} green. ${plural(openedClusters, 'cluster')} opened. ${plural(fixCommits, 'fix commit')}. ${sdkPair}.`
  : `Run ${esc(runId)} recorded no gate result.`;
const lead = hasEvidence
  ? `Run <span class="mono">${esc(runId)}</span> upgraded ${plural(apps.length, 'app')}${apps.length ? ` (${apps.map(esc).join(', ')})` : ''}${platforms.length ? ` across ${platforms.map(esc).join(' and ')}` : ''},
validating through tiered gates from static checks to device-confirmed end-to-end suites. Every claim
below links to evidence under <span class="mono">${esc(dir)}/</span>.`
  : `Run <span class="mono">${esc(runId)}</span> wrote a report carrying no gate
results, so this page shows what it does hold and nothing more. The data files under
<span class="mono">${esc(dir)}/</span> remain the record.`;

// --- KPI tiles, one per fact this run has ----------------------------------
const kpis = [
  (o.from_sdk || o.to_sdk) && kpi('SDK', `${esc(o.from_sdk ?? '—')} → ${esc(o.to_sdk ?? '—')}`),
  matrixRows.length > 0 && kpi('Gates green', `${greens}/${matrixRows.length}`, 'final verify, cell for cell'),
  hasEvidence && kpi('Clusters', String(openedClusters), clusters.length > openedClusters ? `+${clusters.length - openedClusters} pre-existing` : 'post-bump'),
  commits.length > 0 && kpi('Fix commits', String(fixCommits)),
  flakes.length > 0 && kpi('Flakes', String(flakes.length)),
  o.duration_s != null && kpi('Duration', dur(o.duration_s)),
  decisions.length > 0 && kpi('Decisions', String(decisions.length)),
  followUps.length > 0 && kpi('Follow-ups', String(followUps.length)),
].filter(Boolean);

// --- sections, each empty when its data is absent --------------------------
const orchestrationSection = Object.keys(roleCounts).length === 0 ? '' : section('Orchestration model',
`<p>A pure-orchestrator main agent dispatched every unit of work to fresh workers and decided from
compact verdicts; raw logs never entered its context. Worker dispatches by role:</p>
<div class="chips">${Object.entries(roleCounts).map(([r, n]) => `<span class="pill info">${esc(r)} × ${n}</span>`).join(' ')}</div>`);

const matrixSection = matrixRows.length === 0 ? '' : section('Gate matrix',
`<table><tr><th>Gate</th><th>App</th><th>Platform</th><th>Status</th></tr>
${matrixRows.sort((a, b) => a.gate.localeCompare(b.gate) || a.app.localeCompare(b.app)).map(r =>
  `<tr><td class="mono">${esc(r.gate)}</td><td class="mono">${esc(r.app)}</td><td class="mono">${esc(r.plat)}</td><td>${badge(r.st)}</td></tr>`).join('\n')}
</table>`);

const clusterSection = !hasEvidence ? '' : section('Cluster-by-cluster evidence',
clusters.length === 0 ? '<p>No error cluster was opened at any point after the bump — the mechanical version bump carried the workspace through every tier unchanged.</p>' :
clusters.map(c => `<div class="cluster">
<h3><span class="mono">${esc(c.fingerprint)}</span> ${badge(c.status === 'fixed' || c.status === 'green' ? 'green' : c.status === 'blocked' ? 'blocked' : 'red')}
${c.pre_existing ? '<span class="pill warn">pre-existing — not attributed to the upgrade</span>' : ''}</h3>
<p>${esc(c.diagnosis)}</p>
<p><b>Fix:</b> ${esc(c.fix?.diff_summary ?? (typeof c.fix === 'string' ? c.fix : '—'))}${(c.fix?.commit_shas ?? []).length ? ` (<span class="mono">${c.fix.commit_shas.map(s => esc(String(s).slice(0, 7))).join(', ')}</span>)` : ''} · <b>Attempts:</b> ${esc(c.attempts_used ?? '—')} · <b>Validation:</b> ${esc(c.validation ?? '—')}</p>
<p class="mono">${(c.evidence_paths ?? []).map(esc).join('<br>')}</p>
</div>`).join('\n'));

const baselineSection = baseRows.length === 0 ? '' : section('Baseline on the current SDK',
`<table><tr><th>Gate</th><th>App</th><th>Platform</th><th>Status</th><th>Cause</th></tr>
${baseRows.map(r => `<tr><td class="mono">${esc(r.gate)}</td><td class="mono">${esc(r.app)}</td><td class="mono">${esc(r.plat)}</td>
<td>${badge(r.st)}</td><td>${r.cause ? esc(r.cause) : '<span class="delta">—</span>'}</td></tr>`).join('\n')}
</table>`);

const timelineSection = phases.length === 0 && tl.length === 0 ? '' : section('Run timeline',
`<ul class="timeline">
${phases.map(p => `<li><b>${esc(p.phase)}</b> — ${dur(phaseDur(p))}${(byPhase[p.phase] ?? []).length ? ` · ${(byPhase[p.phase]).length} gate results` : ''}</li>`).join('\n')}
</ul>
${Object.entries(byPhase).filter(([, rows]) => rows.some(r => r.gate)).map(([ph, rows]) => `<details><summary>${esc(ph)} — ${plural(rows.length, 'gate')}</summary>
<table><tr><th>Gate</th><th>Duration</th><th>vs baseline</th></tr>
${rows.map(t => `<tr><td class="mono">${esc(t.gate)}</td><td>${dur(t.duration_s)}</td><td class="delta">${t.baseline_s != null ? `baseline ${dur(t.baseline_s)}` : '—'}</td></tr>`).join('\n')}
</table></details>`).join('\n')}`);

const budgetSection = Object.keys(budgets).length === 0
  ? ''
  : section('Timeout budgets',
      `<table><tr><th>Gate</th><th>Baseline</th><th>Timeout</th></tr>
${Object.entries(budgets).map(([g, b]) => `<tr><td class="mono">${esc(g)}</td><td>${dur(b.baseline_s)}</td><td>${dur(b.timeout_s)}</td></tr>`).join('\n')}</table>`);

const decisionsSection = decisions.length === 0 ? '' : section('How this run decided',
`<table><tr><th>Question</th><th>Answer</th>${decisions.some(d => d.changed_outcome) ? '<th>Changed outcome</th>' : ''}</tr>
${decisions.map(d => `<tr><td>${esc(d.question)}</td><td>${esc(d.answer)}</td>${decisions.some(x => x.changed_outcome) ? `<td>${esc(d.changed_outcome ?? '—')}</td>` : ''}</tr>`).join('\n')}</table>`);

const provenanceSection = commits.length === 0 ? '' : section('Commits this run landed',
`<ul>${commits.map(c => `<li><span class="mono">${esc((c.sha ?? '').slice(0, 7))}</span> — ${esc(c.label)}${c.description ? ` — ${esc(c.description)}` : ''}</li>`).join('\n')}</ul>`);

const followUpSection = followUps.length === 0 ? '' : section('Follow-ups',
`<ul>${followUps.map(f => `<li><span class="pill ${f.type === 'warning' ? 'warn' : 'info'}">${esc(f.type ?? 'note')}</span> ${esc(f.description)}</li>`).join('\n')}</ul>`);

// --- the page --------------------------------------------------------------
const body = [
  orchestrationSection, matrixSection,
  clusterSection, baselineSection, timelineSection, budgetSection,
  decisionsSection, provenanceSection, followUpSection,
].filter(Boolean).join('\n\n');

const html = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${hasTarget ? `Expo SDK ${esc(o.to_sdk)} — ` : 'Expo Upgrade — '}${hasEvidence ? 'Evidence Report' : 'Run Report'}</title>
<style>${CSS}</style></head><body><div class="wrap">
<div class="eyebrow">expo-monorepo-upgrade — ${esc(eyebrow)}</div>
<h1>${headline}</h1>
<p class="lead">${lead}</p>
${kpis.length ? `<div class="kpi-grid">\n${kpis.join('\n')}\n</div>` : ''}

${body}

<footer>run ${esc(runId)} · branch upgrade/sdk-${targetLabel} · phase ${esc(state.phase)} · generated ${new Date().toISOString()} by expo-monorepo-upgrade scripts/render-report.mjs</footer>
</div></body></html>`;

const out = join(dir, 'report.html');
writeFileSync(out, html);
console.log(`wrote ${out} (${html.length} bytes, ${hasEvidence ? 'evidence' : 'minimal'} sections)`);
