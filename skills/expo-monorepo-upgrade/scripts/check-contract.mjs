#!/usr/bin/env node

// Validate the prompt-native expo-upgrade.yaml contract and print a normalized plan.
// Uses yaml/js-yaml from the target repository when available, with a small parser
// for the block-style subset emitted by expo-upgrade-setup.

import { existsSync, readFileSync, realpathSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { isAbsolute, join, posix, relative, resolve, sep } from 'node:path';

const root = resolve(process.argv[2] ?? process.cwd());
const contractPath = join(root, 'expo-upgrade.yaml');
const errors = [];
const warnings = [];
const procedures = [];
const error = (where, message) => errors.push(`${where}: ${message}`);
const warning = (where, message) => warnings.push(`${where}: ${message}`);

const loadYaml = (() => {
  const requireFromRepo = createRequire(join(root, 'package.json'));
  for (const [name, adapt] of [
    ['yaml', module => text => module.parse(text)],
    ['js-yaml', module => text => module.load(text)],
  ]) {
    try {
      return adapt(requireFromRepo(name));
    } catch {
      // Fall through to the dependency-free contract subset.
    }
  }
  return miniYaml;
})();

function miniYaml(text) {
  const lines = text.split(/\r?\n/);
  let cursor = 0;
  const indentOf = line => line.match(/^ */)[0].length;
  const isLive = index => index < lines.length
    && lines[index].trim() !== ''
    && !/^\s*#/.test(lines[index]);
  const nextLive = () => {
    while (cursor < lines.length && !isLive(cursor)) cursor += 1;
    return cursor < lines.length;
  };
  const stripComment = value => {
    let output = '';
    let quote = null;
    for (let index = 0; index < value.length; index += 1) {
      const character = value[index];
      if (quote) {
        output += character;
        if (character === quote && value[index - 1] !== '\\') quote = null;
        continue;
      }
      if (character === '"' || character === "'") {
        quote = character;
        output += character;
        continue;
      }
      if (character === '#' && (index === 0 || /\s/.test(value[index - 1]))) break;
      output += character;
    }
    return output.trimEnd();
  };
  const scalar = raw => {
    const value = raw.trim();
    if (value === '' || value === 'null' || value === '~') return null;
    if (value === 'true' || value === 'false') return value === 'true';
    if (/^-?\d+(?:\.\d+)?$/.test(value)) return Number(value);
    if ((value.startsWith('"') && value.endsWith('"'))
      || (value.startsWith("'") && value.endsWith("'"))) {
      return value.slice(1, -1);
    }
    return value;
  };
  const blockScalar = keyIndent => {
    const output = [];
    let contentIndent = null;
    while (cursor < lines.length) {
      const line = lines[cursor];
      if (line.trim() === '') {
        output.push('');
        cursor += 1;
        continue;
      }
      const indent = indentOf(line);
      if (indent <= keyIndent) break;
      contentIndent ??= indent;
      output.push(line.slice(contentIndent));
      cursor += 1;
    }
    return `${output.join('\n').replace(/\n+$/, '')}\n`;
  };
  function block(indent) {
    let map = null;
    let list = null;
    while (nextLive()) {
      const raw = lines[cursor];
      const currentIndent = indentOf(raw);
      if (currentIndent < indent) break;
      const line = stripComment(raw.trim());
      if (line.startsWith('- ')) {
        if (currentIndent !== indent) break;
        list ??= [];
        const rest = line.slice(2);
        if (/^[^:]+:/.test(rest)) {
          lines[cursor] = `${' '.repeat(indent + 2)}${rest}`;
          list.push(block(indent + 2));
        } else {
          list.push(scalar(rest));
          cursor += 1;
        }
        continue;
      }
      if (currentIndent !== indent) break;
      const match = line.match(/^("[^"]+"|'[^']+'|[^:]+):\s*(.*)$/);
      if (!match) throw new Error(`cannot parse line ${cursor + 1}: ${raw.trim()}`);
      const key = scalar(match[1]);
      const rest = match[2].trim();
      map ??= {};
      cursor += 1;
      if (['|', '|-', '>', '>-'].includes(rest)) {
        map[key] = blockScalar(currentIndent);
      } else if (rest === '') {
        const savedCursor = cursor;
        map[key] = nextLive() && indentOf(lines[cursor]) > currentIndent
          ? block(indentOf(lines[cursor]))
          : null;
        if (map[key] === null) cursor = savedCursor;
      } else {
        map[key] = scalar(rest);
      }
    }
    return list ?? map ?? {};
  }
  return block(0);
}

function readContract() {
  try {
    return loadYaml(readFileSync(contractPath, 'utf8'));
  } catch (cause) {
    error('expo-upgrade.yaml', `cannot parse - ${cause.message}`);
    return null;
  }
}

function isMap(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function exactKeys(value, allowed, where) {
  if (!isMap(value)) {
    error(where, 'must be a map');
    return false;
  }
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) error(where, `unknown key \`${key}\``);
  }
  return true;
}

function rejectExplicitNulls(value, keys, where) {
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(value, key) && value[key] == null) {
      error(`${where}.${key}`, 'optional entries must be omitted rather than set to null');
    }
  }
}

const INPUTS = {
  bump: ['target_sdk'],
  changelogs: ['target_sdk', 'additional_changelog_sources', 'changelog_output_dir'],
  validation: [],
  repair_validation: ['cluster_summary', 'failure_evidence'],
  smoke: [],
  full_e2e: [],
  repair_smoke_e2e: ['failed_phase', 'cluster_summary', 'failure_evidence'],
};

function checkProcedure(entry, where, kind, scope) {
  if (!exactKeys(entry, ['description', 'prompt'], where)) return null;
  for (const key of ['description', 'prompt']) {
    if (typeof entry[key] !== 'string' || entry[key].trim() === '') {
      error(where, `\`${key}\` must be a non-empty string`);
    }
  }
  if (typeof entry.description === 'string' && /[\r\n]/.test(entry.description.trim())) {
    error(where, '`description` must fit on one YAML line');
  }

  const prompt = typeof entry.prompt === 'string' ? entry.prompt : '';
  const setupTokens = [...prompt.matchAll(/\[\[([^\]]+)\]\]/g)].map(match => match[1]);
  if (setupTokens.length > 0) {
    error(where, `unresolved setup token(s): ${[...new Set(setupTokens)].join(', ')}`);
  }

  const tokenMatches = [...prompt.matchAll(/\{\{\s*([a-z][a-z0-9_]*)\s*\}\}/g)];
  const tokenNames = tokenMatches.map(match => match[1]);
  const allowedInputs = INPUTS[kind];
  for (const token of new Set(tokenNames)) {
    if (!allowedInputs.includes(token)) {
      error(where, `runtime input \`{{${token}}}\` is not allowed for ${kind}`);
    }
  }
  for (const required of allowedInputs) {
    if (!tokenNames.includes(required)) {
      error(where, `prompt is missing required runtime input \`{{${required}}}\``);
    }
  }
  const stripped = prompt
    .replace(/\{\{\s*[a-z][a-z0-9_]*\s*\}\}/g, '')
    .replace(/\[\[[^\]]+\]\]/g, '');
  if (stripped.includes('{{') || stripped.includes('}}')
    || stripped.includes('[[') || stripped.includes(']]')) {
    error(where, 'contains a malformed runtime or setup token');
  }
  const lines = prompt.split(/\r?\n/).map(line => line.trim());
  for (const match of tokenMatches) {
    if (!lines.includes(match[0].trim())) {
      error(where, `runtime input \`${match[0]}\` must be on its own line`);
    }
  }
  lines.forEach((line, index) => {
    if (!/^\{\{\s*[a-z][a-z0-9_]*\s*\}\}$/.test(line)) return;
    let previous = index - 1;
    while (previous >= 0 && lines[previous] === '') previous -= 1;
    if (previous < 0 || !lines[previous].endsWith(':')) {
      error(where, `runtime input \`${line}\` must follow a label ending in \`:\``);
    }
  });

  const normalized = {
    ref: where,
    kind,
    description: entry.description,
    prompt: entry.prompt,
    runtime_inputs: [...new Set(tokenNames)],
    ...scope,
  };
  procedures.push(normalized);
  return normalized;
}

function checkAppPath(value, where) {
  if (typeof value !== 'string' || value.trim() === '') {
    error(where, 'must be a non-empty repository-relative POSIX path');
    return null;
  }
  if (value.includes('\\') || isAbsolute(value) || posix.isAbsolute(value)) {
    error(where, 'must be a repository-relative POSIX path');
    return null;
  }
  const normalized = posix.normalize(value);
  if (normalized === '..' || normalized.startsWith('../')) {
    error(where, 'must stay inside the repository root');
    return null;
  }
  const absolute = resolve(root, normalized);
  const outside = relative(root, absolute);
  if (outside === '..' || outside.startsWith(`..${sep}`) || isAbsolute(outside)) {
    error(where, 'must stay inside the repository root');
    return null;
  }
  if (!existsSync(absolute) || !statSync(absolute).isDirectory()) {
    error(where, `path \`${value}\` does not exist as a directory`);
    return null;
  }
  try {
    const realRoot = realpathSync(root);
    const realApp = realpathSync(absolute);
    const realOutside = relative(realRoot, realApp);
    if (realOutside === '..' || realOutside.startsWith(`..${sep}`) || isAbsolute(realOutside)) {
      error(where, `path \`${value}\` resolves outside the repository root`);
      return null;
    }
  } catch (cause) {
    error(where, `cannot resolve path \`${value}\` - ${cause.message}`);
    return null;
  }
  return normalized;
}

function checkCompanion(container, procedure, repair, where) {
  if (container[procedure] != null && container[repair] == null) {
    error(where, `\`${procedure}\` requires matching \`${repair}\``);
  }
  if (container[repair] != null && container[procedure] == null) {
    error(where, `\`${repair}\` has no matching \`${procedure}\``);
  }
}

function finish(apps, bump, changelogs) {
  const ok = errors.length === 0;
  const byKind = Object.fromEntries(Object.keys(INPUTS).map(kind => [
    kind,
    procedures.filter(procedure => procedure.kind === kind).length,
  ]));
  const result = {
    schema_version: 1,
    ok,
    contract_path: contractPath,
    errors,
    warnings,
    summary: `${apps.length} app(s), ${procedures.length} procedure(s), ${errors.length} error(s), ${warnings.length} warning(s)`,
    bump,
    changelogs,
    apps,
    procedures,
    counts: byKind,
  };
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  process.exitCode = ok ? 0 : 1;
}

if (!existsSync(contractPath)) {
  error('expo-upgrade.yaml', 'missing at repository root; run expo-upgrade-setup');
  finish([], null, null);
} else {
  const document = readContract();
  const apps = [];
  let bump = null;
  let changelogs = null;
  if (!isMap(document)) {
    if (document !== null) error('expo-upgrade.yaml', 'root must be a map');
  } else {
    exactKeys(document, ['bump', 'changelogs', 'apps'], 'expo-upgrade.yaml');
    if (document.bump == null) {
      error('expo-upgrade.yaml', 'missing required `bump` procedure');
    } else {
      bump = checkProcedure(document.bump, 'bump', 'bump', {
        app_path: null,
        platform: null,
      });
    }
    if (document.changelogs == null) {
      error('expo-upgrade.yaml', 'missing required `changelogs` procedure');
    } else {
      changelogs = checkProcedure(document.changelogs, 'changelogs', 'changelogs', {
        app_path: null,
        platform: null,
      });
    }
    if (!Array.isArray(document.apps) || document.apps.length === 0) {
      error('expo-upgrade.yaml', '`apps` must be a non-empty list');
    } else {
      const seenPaths = new Set();
      document.apps.forEach((app, appIndex) => {
        const where = `apps[${appIndex}]`;
        if (!exactKeys(app, ['path', 'validation', 'repair_validation', 'platforms'], where)) return;
        rejectExplicitNulls(app, ['validation', 'repair_validation', 'platforms'], where);
        const appPath = checkAppPath(app.path, `${where}.path`);
        if (appPath !== null) {
          if (seenPaths.has(appPath)) error(`${where}.path`, `duplicate app path \`${appPath}\``);
          seenPaths.add(appPath);
        }
        checkCompanion(app, 'validation', 'repair_validation', where);
        const scope = { app_path: appPath, platform: null };
        const normalized = {
          index: appIndex,
          path: appPath,
          validation: app.validation == null
            ? null
            : checkProcedure(app.validation, `${where}.validation`, 'validation', scope),
          repair_validation: app.repair_validation == null
            ? null
            : checkProcedure(app.repair_validation, `${where}.repair_validation`, 'repair_validation', scope),
          platforms: {},
        };

        if (app.platforms != null) {
          if (!isMap(app.platforms)) {
            error(`${where}.platforms`, 'must be a map');
          } else if (Object.keys(app.platforms).length === 0) {
            error(`${where}.platforms`, 'empty platform maps must be omitted');
          } else {
            for (const [platform, config] of Object.entries(app.platforms)) {
              const platformWhere = `${where}.platforms.${platform}`;
              if (!/^[A-Za-z0-9._-]+$/.test(platform)) {
                error(`${where}.platforms`, `invalid platform key \`${platform}\``);
                continue;
              }
              if (!exactKeys(config, [
                'validation',
                'repair_validation',
                'smoke',
                'full_e2e',
                'repair_smoke_e2e',
              ], platformWhere)) continue;
              rejectExplicitNulls(config, [
                'validation',
                'repair_validation',
                'smoke',
                'full_e2e',
                'repair_smoke_e2e',
              ], platformWhere);
              if (Object.keys(config).length === 0) {
                error(platformWhere, 'empty platform entries must be omitted');
              }
              checkCompanion(config, 'validation', 'repair_validation', platformWhere);
              const hasRuntime = config.smoke != null || config.full_e2e != null;
              if (hasRuntime && config.repair_smoke_e2e == null) {
                error(platformWhere, '`smoke` or `full_e2e` requires `repair_smoke_e2e`');
              }
              if (!hasRuntime && config.repair_smoke_e2e != null) {
                error(platformWhere, '`repair_smoke_e2e` requires `smoke` or `full_e2e`');
              }
              const platformScope = { app_path: appPath, platform };
              normalized.platforms[platform] = {};
              for (const kind of [
                'validation',
                'repair_validation',
                'smoke',
                'full_e2e',
                'repair_smoke_e2e',
              ]) {
                normalized.platforms[platform][kind] = config[kind] == null
                  ? null
                  : checkProcedure(config[kind], `${platformWhere}.${kind}`, kind, platformScope);
              }
            }
          }
        }
        if (normalized.validation == null && Object.keys(normalized.platforms).length === 0) {
          warning(where, 'app has no configured validation or platform procedure; only the root bump and changelogs procedures cover it');
        }
        apps.push(normalized);
      });
    }
  }
  finish(apps, bump, changelogs);
}
