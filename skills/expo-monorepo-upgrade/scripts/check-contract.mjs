#!/usr/bin/env node
// Validates the expo-upgrade.yaml contract family and prints what the run needs from it.
// Uses the repo's own `yaml`/`js-yaml` when one resolves, else a built-in block-YAML reader.
//
// Prints one JSON object on stdout: { ok, errors[], warnings[], apps[], gates[], prep[], bump }.
// Exit 0 when the contract is usable (warnings allowed), 1 when an error blocks the run.
//
// Usage: node skills/expo-monorepo-upgrade/scripts/check-contract.mjs [repo-root]
import { readFileSync, existsSync, statSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { createRequire } from 'node:module';

const root = process.argv[2] ?? process.cwd();
const errors = [], warnings = [];
const err = (where, msg) => errors.push(`${where}: ${msg}`);
const warn = (where, msg) => warnings.push(`${where}: ${msg}`);

// --- YAML ------------------------------------------------------------------
const loadYaml = (() => {
  for (const [pkg, fn] of [['yaml', m => s => m.parse(s)], ['js-yaml', m => s => m.load(s)]]) {
    try { return fn(createRequire(join(root, 'package.json'))(pkg)); } catch { /* not installed */ }
  }
  return miniYaml;
})();

// Block-style subset the setup skill writes: nested maps, `- ` lists, `|` blocks, [a, b] seqs.
function miniYaml(text) {
  const lines = text.split(/\r?\n/);
  let i = 0;
  const live = n => n < lines.length && lines[n].trim() !== '' && !/^\s*#/.test(lines[n]);
  const nextLive = () => { while (i < lines.length && !live(i)) i++; return i < lines.length; };
  const indentOf = s => s.match(/^ */)[0].length;
  const strip = s => {
    let out = '', q = null;
    for (let k = 0; k < s.length; k++) {
      const c = s[k];
      if (q) { out += c; if (c === q) q = null; continue; }
      if (c === '"' || c === "'") { q = c; out += c; continue; }
      if (c === '#' && (k === 0 || /\s/.test(s[k - 1]))) break;
      out += c;
    }
    return out.trimEnd();
  };
  const scalar = raw => {
    const v = raw.trim();
    if (v === '') return null;
    if (v === 'null' || v === '~') return null;
    if (v === 'true' || v === 'false') return v === 'true';
    if (/^-?\d+(\.\d+)?$/.test(v)) return Number(v);
    if (/^\[.*\]$/.test(v)) return v.slice(1, -1).split(',').map(s => scalar(s)).filter(s => s !== null);
    if (/^".*"$/.test(v) || /^'.*'$/.test(v)) return v.slice(1, -1);
    return v;
  };
  const blockScalar = keyIndent => {
    const buf = [];
    let base = null;
    while (i < lines.length) {
      const raw = lines[i];
      if (raw.trim() === '') { buf.push(''); i++; continue; }
      const ind = indentOf(raw);
      if (ind <= keyIndent) break;
      base ??= ind;
      buf.push(raw.slice(base));
      i++;
    }
    return buf.join('\n').replace(/\n+$/, '') + '\n';
  };
  function block(indent) {
    let map = null, list = null;
    while (nextLive()) {
      const raw = lines[i];
      const ind = indentOf(raw);
      if (ind < indent) break;
      const line = strip(raw.trim());
      if (line.startsWith('- ')) {
        if (ind !== indent) break;
        list ??= [];
        const rest = line.slice(2);
        if (/^[^:]+:/.test(rest)) {
          lines[i] = ' '.repeat(indent + 2) + rest;      // fold "- k: v" into a map at indent+2
          list.push(block(indent + 2));
        } else { list.push(scalar(rest)); i++; }
        continue;
      }
      if (ind !== indent) break;
      const m = line.match(/^("[^"]+"|'[^']+'|[^:]+):\s*(.*)$/);
      if (!m) throw new Error(`cannot parse line ${i + 1}: ${lines[i].trim()}`);
      const key = scalar(m[1]), rest = m[2].trim();
      map ??= {};
      i++;
      if (rest === '|' || rest === '|-' || rest === '>' || rest === '>-') map[key] = blockScalar(ind);
      else if (rest === '') {
        const save = i;
        map[key] = nextLive() && indentOf(lines[i]) > ind ? block(indentOf(lines[i])) : null;
        if (map[key] === null) i = save;
      } else map[key] = scalar(rest);
    }
    return list ?? map ?? {};
  }
  return block(0);
}

const readYaml = (path, where) => {
  try { return loadYaml(readFileSync(path, 'utf8')); }
  catch (e) { err(where, `cannot parse — ${e.message}`); return null; }
};

// --- entry shapes ----------------------------------------------------------
const GATE_KEYS = ['expect', 'flow_selector', 'timeout_s', 'concurrency_groups'];
const ENTRY_KEYS = { command: ['value'], prompt: ['value'], pipeline: ['trigger', 'status', 'logs'] };

function checkEntry(entry, where, allowed, isGate) {
  if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) {
    err(where, 'is not an entry (needs `kind:` and its fields)'); return null;
  }
  const kind = entry.kind;
  if (!kind) { err(where, 'has no `kind`'); return null; }
  if (!allowed.includes(kind)) {
    warn(where, `kind \`${kind}\` — this section takes ${allowed.join(' or ')}; entry ignored`); return null;
  }
  for (const f of ENTRY_KEYS[kind] ?? []) if (!entry[f]) err(where, `kind \`${kind}\` needs \`${f}\``);
  const known = ['kind', ...ENTRY_KEYS[kind] ?? [], 'poll_s', ...(isGate ? GATE_KEYS : [])];
  for (const k of Object.keys(entry)) if (!known.includes(k)) warn(where, `unknown key \`${k}\` — ignored`);
  if (isGate) {
    if (entry.timeout_s != null && typeof entry.timeout_s !== 'number') err(where, '`timeout_s` must be a number');
    if (entry.concurrency_groups != null && !Array.isArray(entry.concurrency_groups))
      err(where, '`concurrency_groups` must be a list');
    if (entry.flow_selector != null) {
      const sel = checkEntry(entry.flow_selector, `${where} → flow_selector`, ['command', 'prompt']);
      if (sel && !`${sel.value ?? ''}`.includes('<flow>'))
        err(`${where} → flow_selector`, 'must contain the `<flow>` placeholder');
    }
  }
  const text = [entry.value, entry.trigger, entry.status, entry.logs].filter(Boolean).join('\n');
  // The run fills exactly three placeholders; anything else would reach a shell unsubstituted.
  const fillable = where.endsWith('bump') ? ['target']
    : where.endsWith('flow_selector') ? ['flow']
    : kind === 'pipeline' ? ['id'] : [];
  for (const [tok, name] of [...text.matchAll(/(?<!\$)\{([a-z_]+)\}/g), ...text.matchAll(/<([a-z_]+)>/g)]
      .map(m => [m[0], m[1]])) {
    if (fillable.includes(name)) continue;
    const known = ['target', 'flow', 'id'].includes(name);
    err(where, known
      ? `\`${tok}\` is not filled here — the run fills {target} in bump, {id} in a pipeline's status/logs, and <flow> in flow_selector`
      : `\`${tok}\` is a placeholder nothing fills — inline the value, or use \`kind: prompt\` so a worker can settle it`);
  }
  return { kind, ...entry };
}

// --- root ------------------------------------------------------------------
const rootPath = join(root, 'expo-upgrade.yaml');
if (!existsSync(rootPath)) {
  err('expo-upgrade.yaml', 'missing — run the expo-monorepo-upgrade-setup skill');
  console.log(JSON.stringify({
    ok: false, errors, warnings,
    summary: 'no contract at the repo root; this repo is not set up for an upgrade',
    apps: [], gates: [], prep: [], bump: null,
  }, null, 2));
  process.exit(1);
}
const rootDoc = readYaml(rootPath, 'expo-upgrade.yaml') ?? {};
const prep = [], gates = [], appsOut = [];

if (rootDoc.version == null) err('expo-upgrade.yaml', 'missing `version`');
if (!rootDoc.setup?.install) err('expo-upgrade.yaml', 'missing `setup.install`');
else if (checkEntry(rootDoc.setup.install, 'setup.install', ['command', 'prompt']))
  prep.push({ name: 'setup.install', path: '.', ...rootDoc.setup.install });

if (!rootDoc.bump) err('expo-upgrade.yaml', 'missing `bump` — the run has no way to move this repo to the target SDK');
const bump = rootDoc.bump ? checkEntry(rootDoc.bump, 'bump', ['command', 'prompt']) : null;
if (bump && !`${bump.value ?? ''}`.includes('{target}'))
  warn('bump', 'no `{target}` placeholder — the same SDK version will be installed on every run');
for (const [plat, group] of Object.entries(rootDoc.tools ?? {}))
  for (const [name, entry] of Object.entries(group ?? {}))
    if (checkEntry(entry, `tools.${plat}.${name}`, ['command', 'prompt']))
      prep.push({ name: `tools.${plat}.${name}`, path: '.', platform: plat, ...entry });

for (const k of Object.keys(rootDoc)) if (!['version', 'setup', 'bump', 'tools', 'apps'].includes(k))
  warn('expo-upgrade.yaml', `unknown key \`${k}\` — ignored`);

if (!Array.isArray(rootDoc.apps) || rootDoc.apps.length === 0) err('expo-upgrade.yaml', 'missing the `apps:` index');

// --- per app ---------------------------------------------------------------
const SINGLE_GATES = { typecheck: 'T0', lint: 'T0', smoke: 'T2', e2e: 'T3' };
const KEYED_GATES = { build: 'T1', test: 'T1' };
const SINGLE_PREP = ['install', 'clean', 'metro', 'environment'];

for (const idx of rootDoc.apps ?? []) {
  const file = idx?.file;
  if (!file) { err('apps[]', `entry ${JSON.stringify(idx)} has no \`file\``); continue; }
  const where = file;
  if (!existsSync(join(root, file))) { err(where, 'file named in the index does not exist'); continue; }
  const app = readYaml(join(root, file), where);
  if (!app) continue;

  for (const k of ['name', 'path', 'platforms']) if (app[k] == null) err(where, `missing \`${k}\``);
  const platforms = Array.isArray(app.platforms) ? app.platforms : [];
  if (app.platforms != null && platforms.length === 0) err(where, '`platforms` must be a non-empty list');
  if (app.path != null && !existsSync(join(root, app.path))) err(where, `\`path\` ${app.path} does not exist`);
  if (app.name && idx.name && app.name !== idx.name)
    warn(where, `\`name\` ${app.name} differs from the index's ${idx.name}`);

  const appPath = app.path ?? dirname(file);
  const push = (id, tier, plats, entry) =>
    gates.push({ id, app: app.name, tier, platforms: plats, path: appPath, ...entry });

  for (const [sec, tier] of Object.entries(SINGLE_GATES)) {
    if (app[sec] == null) continue;
    const e = checkEntry(app[sec], `${where} → ${sec}`, ['command', 'pipeline'], true);
    if (!e) continue;
    if ((tier === 'T2' || tier === 'T3') && !e.flow_selector)
      warn(`${where} → ${sec}`, 'no `flow_selector` — a failed flow replays the whole suite on every flake screen and post-fix re-run; harmless only if this suite is a single flow');
    push(sec, tier, tier === 'T2' || tier === 'T3' ? platforms : ['*'], e);
  }
  for (const [sec, tier] of Object.entries(KEYED_GATES)) {
    for (const [key, entry] of Object.entries(app[sec] ?? {})) {
      const e = checkEntry(entry, `${where} → ${sec}.${key}`, ['command', 'pipeline'], true);
      if (!e) continue;
      if (sec === 'build' && !platforms.includes(key))
        warn(where, `\`build.${key}\` names a platform not in \`platforms\``);
      push(`${sec}.${key}`, tier, sec === 'build' ? [key] : ['*'], e);
    }
  }
  for (const sec of SINGLE_PREP) {
    if (app[sec] == null) continue;
    const e = checkEntry(app[sec], `${where} → ${sec}`, ['command', 'prompt']);
    if (e) prep.push({ name: `${app.name}.${sec}`, app: app.name, path: appPath, ...e });
  }
  for (const [plat, entry] of Object.entries(app.run ?? {})) {
    const e = checkEntry(entry, `${where} → run.${plat}`, ['command', 'prompt']);
    if (e) prep.push({ name: `${app.name}.run.${plat}`, app: app.name, path: appPath, platform: plat, ...e });
  }
  const knownApp = ['name', 'path', 'platforms', 'run', ...Object.keys(SINGLE_GATES), ...Object.keys(KEYED_GATES), ...SINGLE_PREP];
  for (const k of Object.keys(app)) if (!knownApp.includes(k)) warn(where, `unknown key \`${k}\` — ignored`);

  appsOut.push({ name: app.name, path: appPath, platforms, file });
}

// --- index vs tree ---------------------------------------------------------
const expand = pattern => {
  const parts = pattern.split('/');
  let dirs = [''];
  for (const part of parts) {
    const next = [];
    for (const d of dirs) {
      const abs = join(root, d);
      if (!existsSync(abs) || !statSync(abs).isDirectory()) continue;
      if (part === '*') next.push(...readdirSync(abs).filter(n => !n.startsWith('.') &&
        statSync(join(abs, n)).isDirectory()).map(n => join(d, n)));
      else if (existsSync(join(abs, part))) next.push(join(d, part));
    }
    dirs = next;
  }
  return dirs;
};
try {
  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  const globs = Array.isArray(pkg.workspaces) ? pkg.workspaces : pkg.workspaces?.packages ?? [];
  const indexed = new Set(appsOut.flatMap(a => [a.path, dirname(a.file)].map(p => p.replace(/^\.\//, ''))));
  for (const g of globs) for (const dir of expand(g)) {
    const man = join(root, dir, 'package.json');
    if (!existsSync(man)) continue;
    const m = JSON.parse(readFileSync(man, 'utf8'));
    const isExpo = m.dependencies?.expo || m.devDependencies?.expo;
    if (isExpo && !indexed.has(dir))
      warn('apps[]', `${dir} depends on expo but is not in the index — re-run the setup skill; it stays out of this run`);
  }
} catch { /* no root manifest to compare against */ }

const byTier = t => gates.filter(g => g.tier === t).length;
const ok = errors.length === 0;
console.log(JSON.stringify({
  ok, errors, warnings,
  summary: `${appsOut.length} app(s), ${gates.length} gate(s) (${['T0','T1','T2','T3'].map(t => `${byTier(t)} ${t}`).join(', ')}), ${prep.length} preparation entr(ies), ${errors.length} error(s), ${warnings.length} warning(s)`,
  apps: appsOut, gates, prep, bump,
}, null, 2));
process.exit(ok ? 0 : 1);
