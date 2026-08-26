import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const script = join(dirname(fileURLToPath(import.meta.url)), 'check-contract.mjs');

const changelogsProcedure = `changelogs:
  description: "Download changelog references."
  prompt: |
    Target Expo SDK:
    {{target_sdk}}
    Additional changelog sources:
    {{additional_changelog_sources}}
    Changelog download directory:
    {{changelog_output_dir}}
    Download the applicable references.
`;

function validate(yaml, paths = []) {
  const root = mkdtempSync(join(tmpdir(), 'expo-upgrade-contract-'));
  try {
    for (const path of paths) mkdirSync(join(root, path), { recursive: true });
    writeFileSync(join(root, 'expo-upgrade.yaml'), yaml);
    const result = spawnSync(process.execPath, [script, root], { encoding: 'utf8' });
    return {
      status: result.status,
      stderr: result.stderr,
      json: JSON.parse(result.stdout),
    };
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test('accepts the prompt-native hierarchy and normalizes procedures', () => {
  const result = validate(`
bump:
  description: "Upgrade the repository."
  prompt: |
    Target SDK:
    {{target_sdk}}
    Run the approved repository bump.
${changelogsProcedure}
apps:
  - path: "apps/mobile"
    validation:
      description: "Validate the application."
      prompt: |
        Run static validation.
    repair_validation:
      description: "Repair application validation."
      prompt: |
        Cluster summary:
        {{cluster_summary}}
        Failure evidence:
        {{failure_evidence}}
    platforms:
      ios:
        validation:
          description: "Validate iOS."
          prompt: |
            Build iOS.
        repair_validation:
          description: "Repair iOS validation."
          prompt: |
            Cluster summary:
            {{cluster_summary}}
            Failure evidence:
            {{failure_evidence}}
        smoke:
          description: "Smoke test iOS."
          prompt: |
            Run smoke.
        full_e2e:
          description: "Run full iOS E2E."
          prompt: |
            Run all E2E flows.
        repair_smoke_e2e:
          description: "Repair iOS runtime validation."
          prompt: |
            Failed phase:
            {{failed_phase}}
            Cluster summary:
            {{cluster_summary}}
            Failure evidence:
            {{failure_evidence}}
`, ['apps/mobile']);

  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.json.ok, true);
  assert.equal(result.json.procedures.length, 9);
  assert.equal(result.json.changelogs.kind, 'changelogs');
  assert.equal(result.json.counts.changelogs, 1);
  assert.equal(result.json.apps[0].platforms.ios.full_e2e.kind, 'full_e2e');
});

test('allows an app covered only by the root procedures', () => {
  const result = validate(`
bump:
  description: "Upgrade the repository."
  prompt: |
    Target SDK:
    {{target_sdk}}
${changelogsProcedure}
apps:
  - path: "."
`);

  assert.equal(result.status, 0);
  assert.equal(result.json.ok, true);
  assert.equal(result.json.warnings.length, 1);
});

test('rejects legacy command and per-app-file fields', () => {
  const result = validate(`
version: 1
bump:
  kind: command
  value: npm install expo
apps:
  - name: mobile
    file: apps/mobile/expo-upgrade.yaml
`);

  assert.equal(result.status, 1);
  assert.equal(result.json.ok, false);
  assert.match(result.json.errors.join('\n'), /unknown key `version`/);
  assert.match(result.json.errors.join('\n'), /unknown key `kind`/);
});

test('requires repair companions for configured executable scopes', () => {
  const result = validate(`
bump:
  description: "Upgrade the repository."
  prompt: |
    Target SDK:
    {{target_sdk}}
${changelogsProcedure}
apps:
  - path: "."
    validation:
      description: "Validate the app."
      prompt: |
        Run validation.
    platforms:
      android:
        smoke:
          description: "Smoke test Android."
          prompt: |
            Run smoke.
`);

  assert.equal(result.status, 1);
  assert.match(result.json.errors.join('\n'), /validation` requires matching `repair_validation/);
  assert.match(result.json.errors.join('\n'), /requires `repair_smoke_e2e`/);
});

test('rejects unknown and inline runtime inputs', () => {
  const result = validate(`
bump:
  description: "Upgrade the repository."
  prompt: |
    Upgrade to {{target_sdk}} using {{package_manager}}.
${changelogsProcedure}
apps:
  - path: "."
`);

  assert.equal(result.status, 1);
  assert.match(result.json.errors.join('\n'), /package_manager/);
  assert.match(result.json.errors.join('\n'), /must be on its own line/);
});

test('rejects app paths outside the repository', () => {
  const result = validate(`
bump:
  description: "Upgrade the repository."
  prompt: |
    Target SDK:
    {{target_sdk}}
${changelogsProcedure}
apps:
  - path: "../outside"
`);

  assert.equal(result.status, 1);
  assert.match(result.json.errors.join('\n'), /must stay inside the repository root/);
});

test('rejects explicit null procedures and unlabeled runtime inputs', () => {
  const result = validate(`
bump:
  description: "Upgrade the repository."
  prompt: |
    {{target_sdk}}
${changelogsProcedure}
apps:
  - path: "."
    validation: null
`);

  assert.equal(result.status, 1);
  assert.match(result.json.errors.join('\n'), /must be omitted rather than set to null/);
  assert.match(result.json.errors.join('\n'), /must follow a label ending/);
});

test('requires the root changelogs procedure', () => {
  const result = validate(`
bump:
  description: "Upgrade the repository."
  prompt: |
    Target SDK:
    {{target_sdk}}
apps:
  - path: "."
`);

  assert.equal(result.status, 1);
  assert.match(result.json.errors.join('\n'), /missing required `changelogs` procedure/);
});

test('rejects missing and inline changelog runtime inputs', () => {
  const result = validate(`
bump:
  description: "Upgrade the repository."
  prompt: |
    Target SDK:
    {{target_sdk}}
changelogs:
  description: "Download changelog references."
  prompt: |
    Target Expo SDK:
    {{target_sdk}}
    Additional changelog sources: {{additional_changelog_sources}}
apps:
  - path: "."
`);

  assert.equal(result.status, 1);
  assert.match(result.json.errors.join('\n'), /changelog_output_dir/);
  assert.match(result.json.errors.join('\n'), /must be on its own line/);
});

test('rejects unknown changelog runtime inputs', () => {
  const result = validate(`
bump:
  description: "Upgrade the repository."
  prompt: |
    Target SDK:
    {{target_sdk}}
changelogs:
  description: "Download changelog references."
  prompt: |
    Target Expo SDK:
    {{target_sdk}}
    Additional changelog sources:
    {{additional_changelog_sources}}
    Changelog download directory:
    {{changelog_output_dir}}
    Extra input:
    {{package_manager}}
apps:
  - path: "."
`);

  assert.equal(result.status, 1);
  assert.match(result.json.errors.join('\n'), /package_manager/);
  assert.match(result.json.errors.join('\n'), /not allowed for changelogs/);
});
