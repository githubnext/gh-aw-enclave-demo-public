const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { test } = require('node:test');
const { inject, images, version, checksums } = require('./inject-enclave-runtime.cjs');

const base = path.resolve(__dirname, '../workflows/roadmap-triage-enclave');
const source = fs.readFileSync(base + '.md', 'utf8');
const lock = fs.readFileSync(base + '.lock.yml', 'utf8');
const configLines = lock.split('\n').filter(line =>
  line.includes(`printf '%s\\n' "{`) && line.endsWith(' > "${RUNNER_TEMP}/gh-aw/awf-config.json"'));
const configs = configLines.map(line => JSON.parse(
  line.match(/printf '%s\\n' "(.*)" > /)[1]
    .replace(/\\([\\"$])/g, '$1').replace('${GH_AW_MAX_AI_CREDITS}', '1')));

test('both compiled AWF installers bind step-local attestation credentials', () => {
  const installers = [...lock.matchAll(/^      - name: Install AWF binary\n[\s\S]*?(?=^      - |(?![\s\S]))/gm)];
  assert.equal(installers.length, 2);
  for (const [step] of installers) {
    assert.match(step, /^        env:\n(?:          [^\n]*\n)*          GH_TOKEN: \$\{\{ github.token \}\}$/m);
    assert.match(step, /^        env:\n(?:          [^\n]*\n)*          GH_HOST: github\.com$/m);
    assert(step.includes('gh attestation verify'));
    for (const binding of ['GH_TOKEN: ${{ github.token }}', 'GH_HOST: github.com']) {
      assert.throws(() => inject(lock.replace(step, step.replace(`          ${binding}\n`, '')), source));
    }
  }
});

test('fresh injection preserves existing installer environment fields', () => {
  const compilerLock = lock
    .replace(/^# Enclave runtime bridge:[^\n]*\n/m, '')
    .replaceAll(String.raw`\"imageTag\":\"${configs[0].container.imageTag}\"`, String.raw`\"imageTag\":\"0.29.4\"`)
    .replace(String.raw`\"enclaveDebugPublic\":true,`, '')
    .replace(/^(\s+GH_AW_MCP_CLI_SERVERS_LIST: )(".*")$/m, (_, prefix, value) =>
      prefix + JSON.stringify(JSON.parse(value).split('\n\nFor `awf-enclave enclave_run_agent`')[0]))
    .replace(/^      - name: Install AWF binary\n[\s\S]*?(?=^      - |(?![\s\S]))/gm,
      '      - name: Install AWF binary\n' +
      '        env:\n' +
      '          EXISTING_INSTALLER_ENV: preserved\n' +
      '          GH_TOKEN: ${{ secrets.OTHER_TOKEN }}\n' +
      '          GH_HOST: example.invalid\n' +
      `        run: bash "\${RUNNER_TEMP}/gh-aw/actions/install_awf_binary.sh" ${version} --checksums-sha256 ${checksums} --rootless\n`);
  const injected = inject(compilerLock, source);
  assert.equal((injected.match(/          EXISTING_INSTALLER_ENV: preserved\n/g) || []).length, 2);
  assert(!injected.includes('secrets.OTHER_TOKEN'));
  assert(!injected.includes('GH_HOST: example.invalid'));
  assert.equal(inject(injected, source), injected);
});

test('the lock preserves public policy, host-only credentials and rootless execution', () => {
  assert.equal(configs.length, 2);
  const agent = configs.find(config => config.enclaves);
  assert.equal(agent.enclaveDebugPublic, true);
  assert.equal(agent.network.isolation, true);
  assert.deepEqual(agent.enclaves[0].repos, [{ repo: 'github/gh-aw-firewall', sensitivity: 'public' }]);
  assert.deepEqual(agent.enclaves[0].agent.tools.github.allowed, ['list_issues', 'issue_read']);
  assert.equal(agent.enclaves[0].maxInvocations, 1);
  assert.equal(agent.enclaves[0].maxOutputBytes, 64);
  assert.equal(agent.enclaves[0].agent.maxTaskBytes, 4096);
  assert.equal(agent.enclaves[0].timeout, 180);
  assert(lock.includes('--exclude-env GH_TOKEN'));
  assert(source.includes('excluded-env:\n  - GH_TOKEN'));
  assert.equal((lock.match(/--checksums-sha256 "\$checksums_sha256" --rootless/g) || []).length, 2);
  assert.equal((lock.match(/refs\/tags\/v0\.29\.4/g) || []).length, 3);
  assert(!/sudo[^\n]*\bawf\s/.test(lock));
});

test('all AWF images and manifest entries agree with authenticated release pins', () => {
  const manifest = JSON.parse(lock.split('\n')[1].slice('# gh-aw-manifest: '.length));
  assert.deepEqual(manifest.resolution_failures, []);
  for (const config of configs) {
    const [tag, ...pins] = config.container.imageTag.split(',');
    assert.equal(tag, version.slice(1));
    assert.deepEqual(Object.fromEntries(pins.map(pin => pin.split('='))),
      Object.fromEntries(Object.entries(images).map(([name, digest]) => [name, `sha256:${digest}`])));
  }
  for (const [name, digest] of Object.entries(images)) {
    const image = `ghcr.io/github/gh-aw-firewall/${name}:0.29.4`;
    assert(manifest.containers.some(pin => pin.image === image
      && pin.pinned_image === `${image}@sha256:${digest}`));
  }
  const downloads = lock.split('\n').filter(line => line.includes('download_docker_images.sh'));
  assert.equal(downloads.length, 2);
  for (const line of downloads) {
    assert(!/ghcr\.io\/github\/gh-aw-firewall\/[a-z-]+:0\.29\.4(?:\s|$)/.test(line));
    assert(line.includes(`cli-proxy:0.29.4@sha256:${images['cli-proxy']}`));
  }
});

test('prepare precedes AWF and collection/upload run after failure without raw publication', () => {
  const prepare = lock.indexOf('id: prepare-enclave-diagnostics');
  const execute = lock.indexOf('id: agentic_execution');
  const collect = lock.indexOf('id: collect-enclave-diagnostics');
  assert(prepare > 0 && prepare < execute && execute < collect);
  const collection = lock.slice(collect, lock.indexOf('# Small dedicated copy', collect));
  assert(collection.includes("if: always() && steps.prepare-enclave-diagnostics.outcome == 'success'"));
  assert(collection.includes('collect docker'));
  assert(!collection.includes("steps.collect-enclave-diagnostics.outcome == 'success'"));
  assert(!collection.includes('continue-on-error:'));
  assert(collection.includes('retention-days: 1\n'));
  assert(!collection.includes('GH_AW_DEFAULT_ARTIFACT_RETENTION_DAYS'));
  assert(collection.includes('/upload/'));
  assert(collection.includes('if-no-files-found: warn'));
  assert(!collection.includes('debug-artifacts'));
  assert(!lock.includes('Stage approved public enclave diagnostic metadata'));
  assert(!lock.includes('awf-enclave-operator'));
  assert(!source.includes('def collect('));
  assert(lock.includes('/usr/bin/node /var/lib/awf-enclave-smoke-export/collector.cjs'));
});

test('authored host lifecycle scripts agree with the compiled lock', () => {
  const authoredRuns = [...source.matchAll(/^    run: \|\n((?:      [^\n]*\n)+)/gm)]
    .map(match => match[1].split('\n').map(line => line.slice(6)).join('\n'));
  const compiledRuns = [...lock.matchAll(/^        run: ("(?:[^"\\]|\\.)*")$/gm)]
    .map(match => JSON.parse(match[1]).replace(/\n$/, ''));
  assert.equal(authoredRuns.length, 4);
  for (const run of authoredRuns) assert(compiledRuns.includes(run.replace(/\n$/, '')), 'Authored host script missing from lock');
});

test('the compiler bridge is idempotent and rejects version or compiler drift', () => {
  assert.equal(inject(lock, source), lock);
  assert.throws(() => inject(lock, source.replace(`version: ${version}`, 'version: v0.29.3')));
  assert.throws(() => inject(lock, source.replaceAll(checksums, '0'.repeat(64))));
  assert.throws(() => inject(lock.replace('"compiler_version":"v1.0.1"', '"compiler_version":"dev"'), source));
  assert.throws(() => inject(lock.replaceAll(images.squid, '0'.repeat(64)), source));
  assert.throws(() => inject(lock.replace('retention-days: 1\n', 'retention-days: 30\n'), source));
});

const collectorPath = process.env.AWF_COLLECTOR_PATH;
test('released Docker CLI collects public failure evidence and rejects unsafe synthetic fixtures',
  { skip: !collectorPath }, () => {
    const bytes = fs.readFileSync(collectorPath);
    assert.equal(createHash('sha256').update(bytes).digest('hex'),
      '7722affc5c076d79692d4268a543ef267281424ad4b374eb8f80c24cbec08cae');
    const collector = require(path.resolve(collectorPath));
    const uid = process.getuid();
    const gid = process.getgid();
    const runId = 'a'.repeat(32);
    const invocationId = 'b'.repeat(24);
    // Public test data matching upstream commonEnvelope(); no local validator.
    const envelope = () => ({
      version: 1, runId, invocationId, entryId: 'agent', runtime: 'docker', executorKind: 'agent',
      stage: 'execution', failure: 'workload-exit', exitCode: 1, workloadStopped: true,
      workloadLaunched: true, stopProof: 'verified',
      stages: [{ stage: 'workload-exit', status: 'succeeded' }],
      streams: { stdout: 'captured', stderr: 'captured', session: 'captured' },
      streamCoverage: {
        stdout: { artifactSource: 'backend-stream', agentSession: 'unavailable' },
        stderr: { artifactSource: 'backend-stream', agentSession: 'unavailable' },
        copilotDiagnostics: 'unavailable',
      },
      session: { status: 'captured', bytes: 10, events: [{ event: 'failure', category: 'engine-failed' }] },
      backendEvidence: {
        dockerInspect: { status: 'captured', running: false, exitCode: 1, oomKilled: false },
        vmCounters: { status: 'not-applicable' }, network: { status: 'unavailable' },
      },
    });
    const cases = [
      ['eligible failure', () => {}, 0],
      ['private', value => { value.retentionEligibility = { publicDebug: true, repositoryVisibility: 'private' }; }, 1, 'retention-eligibility'],
      ['disabled capture', value => { value.retentionEligibility = { publicDebug: false, repositoryVisibility: 'all-public-verified' }; }, 1, 'retention-eligibility'],
      ['identity', value => { value.invocationId = 'c'.repeat(24); }, 1, 'diagnostics-identity'],
      ['stop proof', value => { value.workloadStopped = false; }, 1, 'stop-proof'],
      ['running Docker', value => { value.backendEvidence.dockerInspect.running = true; }, 1, 'docker-stop-proof'],
      ['symlink', (_, directory) => {
        fs.unlinkSync(path.join(directory, 'stderr.log'));
        fs.symlinkSync('stdout.log', path.join(directory, 'stderr.log'));
      }, 1, 'source-link'],
      ['hardlink', (_, directory) => fs.linkSync(path.join(directory, 'stderr.log'), path.resolve(directory, '../../..', 'linked.log')), 1, 'file-links'],
      ['permissions', (_, directory) => fs.chmodSync(path.join(directory, 'stderr.log'), 0o644), 1, 'file-permissions'],
      ['oversized', (_, directory) => fs.truncateSync(path.join(directory, 'stderr.log'), collector.MAX_STREAM_BYTES + 1), 1, 'file-size'],
      ['absent', () => {}, 1, 'run-evidence'],
    ];
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'awf-public-collector-'));
    try {
      for (const [index, [name, mutate, expected, failedCheck]] of cases.entries()) {
        const root = path.join(temp, String(index));
        const exportRoot = path.join(root, 'export');
        const roots = { backend: 'docker', sourceUid: uid, trustedRoot: root,
          journal: path.join(root, 'journal'), debug: path.join(root, 'debug') };
        for (const directory of [exportRoot, roots.journal, roots.debug]) {
          fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
        }
        const options = { privilegedUid: uid, exportRoot, exportTrustedRoot: root,
          candidatesForBackend: () => [roots] };
        const args = ['docker', '123-1', String(uid), String(gid)];
        assert.equal(collector.main(['prepare', ...args], options), 0);
        const directory = path.join(roots.debug, runId, invocationId);
        if (name !== 'absent') {
          fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
          fs.writeFileSync(path.join(roots.journal, runId + '.journal'), [
            { version: 1, runId, state: 'open' },
            { runId, invocationId, entryId: 'agent', state: 'terminal', outcome: 'executor-failure' },
          ].map(value => JSON.stringify(value) + '\n').join(''), { mode: 0o600 });
          for (const stream of ['stdout.log', 'stderr.log', 'enclave-session.log']) {
            fs.writeFileSync(path.join(directory, stream),
              'public synthetic detail ghp_abcdefghijklmnopqrstuvwxyz1234567890abcd\n', { mode: 0o600 });
          }
          const value = envelope();
          mutate(value, directory);
          fs.writeFileSync(path.join(directory, 'diagnostics.json'), JSON.stringify(value), { mode: 0o600 });
        }
        assert.equal(collector.main(['collect', ...args], options), expected, name);
        const upload = path.join(exportRoot, '123-1/upload');
        const names = fs.readdirSync(upload).sort();
        if (expected === 0) {
          assert.deepEqual(names, ['collection-status.txt', 'diagnostics.json', 'enclave-session.log', 'stderr.log', 'stdout.log']);
          const projected = JSON.parse(fs.readFileSync(path.join(upload, 'diagnostics.json')));
          assert.equal(projected.exitCode, 1);
          assert.equal(projected.failure, 'workload-exit');
          assert.equal(projected.session.events[0].category, 'engine-failed');
          assert.equal(projected.streams.stderr, 'captured');
          assert(!fs.readFileSync(path.join(upload, 'stderr.log'), 'utf8').includes('ghp_'));
          assert.equal(fs.statSync(path.join(directory, 'diagnostics.json')).mode & 0o777, 0o600);
        } else {
          assert.deepEqual(names, ['collection-status.txt'], name);
          const status = fs.readFileSync(path.join(upload, 'collection-status.txt'), 'utf8');
          assert(status.includes(`failedCheck=${failedCheck}`), status);
          assert(status.length < 4096 && !status.includes(temp));
        }
      }
    } finally {
      fs.rmSync(temp, { recursive: true, force: true });
    }
  });
