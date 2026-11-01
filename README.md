# gh-aw-enclave-demo-public
Public repo for demonstrating enclaves in GitHub Agentic Workflows

The workflows are compiled with [GitHub Agentic Workflows v1.0.1](https://github.com/github/gh-aw/releases/tag/v1.0.1).
To regenerate the vulnerable workflow's lock file using that compiler version:

```bash
gh aw version # Must report v1.0.1, not a development build.
gh aw compile roadmap-triage-vulnerable --gh-aw-ref v1.0.1 --no-check-update
```

The vulnerable workflow is unchanged and uses the compiler's default runtime
versions. The enclave workflow uses **AWF v0.29.5**, preserving the authenticated
Docker storage helper bridge from #57/#59. Its helper installation and shared
collector lifecycle are now authored in `roadmap-triage-enclave.md`. Regenerate
only that workflow, then apply the checked-in runtime injection:

```bash
gh aw version # Must report the official v1.0.1, not a development build.
gh aw compile roadmap-triage-enclave --gh-aw-ref v1.0.1 --no-check-update
node .github/aw/inject-enclave-runtime.cjs
node .github/aw/inject-enclave-runtime.cjs --check
node --test .github/aw/enclave-diagnostics.test.cjs
```

Do not commit or execute the compiler's intermediate lock without injection.
gh-aw v1.0.1 supports the authored AWF version/checksum and lifecycle steps, but
not `enclaveDebugPublic` or the release's full image-digest selector. The narrow,
fail-closed injection supplies those fields, reconciles the manifest and public
prompt hint, binds step-local `GH_TOKEN: ${{ github.token }}` and
`GH_HOST: github.com` for attestation verification in both rootless CLI
installers, preserves release attestation/tag binding, and fixes diagnostic
retention to one day (the compiler otherwise allows a repository variable to
override it). It does not copy the upstream
collector or its validator. Compiler-generated metadata hashes reflect the
authored source. The workflow body is loaded from the `.md` source at runtime.

**Enclave Dependency Check** is a public-target execution probe for
`github/gh-aw-firewall` with `sensitivity: public`, not `trusted`. In
[AWF v0.29.5's policy](https://github.com/github/gh-aw-firewall/blob/3929c9a15c0f239b772affcaae6e55fec92f41c2/src/types/enclave-options.ts),
`public` has a `null` per-run bit budget (no finite bit ceiling); the confidential
8-bit ceiling does not apply. Free-form strings remain reserved for `trusted`
repositories. This probe deliberately retains the six-outcome schema, 64-byte
output, 4096-byte task, 180-second timeout and one-invocation limits. GitHub MCP
access remains scoped to the public target and only `list_issues`/`issue_read`.
The API selector is still named `privateRepo`, and the compiler's scoped
write-sink label retains its `private:` prefix; neither changes the public
runtime sensitivity. Network isolation and rootless AWF are preserved. Host
elevation is limited to authenticated helper installation/probing and the
upstream collector's authenticated interpreter installation, preparation and
collection.

The [v0.29.5 release](https://github.com/github/gh-aw-firewall/releases/tag/v0.29.5)
includes [github/gh-aw-firewall#10940](https://github.com/github/gh-aw-firewall/pull/10940),
which addresses [github/gh-aw-firewall#10939](https://github.com/github/gh-aw-firewall/issues/10939).
It pre-extracts Copilot's native distribution during image construction, seals
it root-owned and non-writable, and selects the fixed image runtime through
`COPILOT_CLI_DIST_DIR` (including the explicit Cloud Hypervisor environment).
Writable Docker invocation storage remains `noexec`; this upgrade does not
relax that boundary or add a runtime-path override. Consuming the released
fix is not evidence that hosted native loading has succeeded.

The enclave workflow's scoped GitHub tools use `GH_AW_GITHUB_MCP_SERVER_TOKEN`
or `GH_AW_GITHUB_TOKEN` with read access to the public target.

The enclave workflow also requires `GH_AW_GITHUB_TOKEN` with read access to the
configured public repository for **host-side repository staging**. A `pre-agent-steps`
step binds that secret to step-local `GH_TOKEN`, fails explicitly if it is
missing, and writes it to `GITHUB_ENV` so the later AWF execution inherits it.
The gateway's step-local token binding alone does not reach AWF.
`excluded-env: [GH_TOKEN]` remains in place and compiles to
`--exclude-env GH_TOKEN`, keeping this credential out of the primary agent
container. Do not remove that exclusion.

In gh-aw v1.0.1, `--fix` rejects secret-bearing top-level `env` and removes
non-engine credentials from `engine.env`. The supported pre-agent step avoids
both configurations. The compiler still warns about persisting secrets via
`GITHUB_ENV`; this workflow retains its existing `strict: false`, and relies on
the explicit AWF exclusion for this host-only credential.

## Public enclave diagnostics

The workflow consumes the maintained
[`collect-enclave-smoke-debug.cjs`](https://github.com/github/gh-aw-firewall/blob/3929c9a15c0f239b772affcaae6e55fec92f41c2/scripts/ci/collect-enclave-smoke-debug.cjs)
from v0.29.5, which retains
[github/gh-aw-firewall#10930](https://github.com/github/gh-aw-firewall/pull/10930).
The release tag is commit `3929c9a15c0f239b772affcaae6e55fec92f41c2`, whose parent
is the attested build source `bcfbba518a6498d8cf1b93f35c2008d6216f227f`; the
collector and installer are byte-identical in both. The collector was also
compared byte-for-byte with v0.29.4 and is unchanged. Its SHA-256 is
`7722affc5c076d79692d4268a543ef267281424ad4b374eb8f80c24cbec08cae`.
The official installer is pinned to the same release commit with SHA-256
`a6f844a1f1891bc4ddbb4b95c7d5cfd994e4f61aa1210ad655b36e92128b1202`.
Both CLI installers authenticate `checksums.txt` and `release-identity.txt`,
bind checksum digest
`df77f6dd216030f6c604839136ccfed07b922690594db518a83ff3bcc555e788`
to `refs/tags/v0.29.5`, and remain rootless. The released helper's SHA-256 is
`648b2b0045cabc320362fabaa4ce6b42be7f340813c85fffc2bd0bc3c71f1d5c`;
the authenticated installer checks it against the release checksum manifest
before installation, and the workflow probes version `0.29.5`.
All six AWF image digests are recorded
in the injection source and were verified against the release-attested
`containers.txt` and public GHCR tags. The manifest's SHA-256 is
`52b79c57b3a7a95d5a0177be0882316d82ef137b977c26fbc544e1be242cec5b`;
`release-identity.txt` has SHA-256
`2f785482355241f1b0b53f5daf3c8fcb45e70eec25498a1646390300da770fcb`.
These assets and the helper were verified with the public release workflow's
GitHub-hosted, GitHub Actions OIDC attestations, whose build source is the parent
commit above.

The hosted Ubuntu 26.04 runner in
[run 41255406408](https://github.com/githubnext/gh-aw-enclave-demo-public/actions/runs/41255406408)
had Node v24.22.1 on PATH in `/opt/hostedtoolcache`, but no `/usr/bin/node`;
the old preparation check failed before downloading the collector. A toolcache
path is not a root-execution trust anchor: the official runner-image setup makes
`/opt` writable. The workflow therefore does not execute PATH-selected Node as
root or change toolcache ownership/permissions.

Instead, preparation downloads the official **Node v24.22.1** Linux archive for
the host's x64 or arm64 architecture from `nodejs.org`. Archive SHA-256 pins from
the release's [SHASUMS256.txt](https://nodejs.org/dist/v24.22.1/SHASUMS256.txt) are
`6c172a9ab6718f7b801fb5a7bd486af2ee5e32758086a04b84fcce2aa77095e6` (x64) and
`dbabf7a1cbf947e6059ffad2c27b80041db97dea1e553b62afdee7f13fca336e` (arm64).
Isolated host Python rechecks the exact bounded archive bytes under root, then
extracts only its fixed regular executable member, never the archive's paths,
links or other files. Download and archive/executable sizes are bounded.
Root-owned, non-group/other-writable, non-symlink destination ancestry is checked
before exclusively creating `/var/lib/awf-enclave-smoke-export/node` with mode
`0500`. Existing bindings, unsupported architectures, checksum mismatches and
unsafe files/directories fail explicitly with bounded category-only errors.
Both preparation and collection use this same protected interpreter with an
empty environment and fixed system PATH, not step outputs, runtime overrides or
agent-writable cache content. This adds an authenticated download dependency;
its failure prevents preparation rather than falling back to untrusted Node.

Before execution, the workflow also installs the collector root-owned, mode `0600`,
under `/var/lib/awf-enclave-smoke-export`, outside agent-writable paths, and calls
`prepare docker RUN_ID-RUN_ATTEMPT RUNNER_UID RUNNER_GID` using the host runner's
identity. After AWF returns through teardown, `collect` uses the same binding,
including after execution failure. No caller-selected source roots are supplied.
Upstream validates eligibility, run/invocation identity, workload-stop evidence,
file ownership, permissions, links and bounds before publishing.

The one-day `public-enclave-debug-RUN_ID-RUN_ATTEMPT` artifact uploads **only**
the collector's validated, runner-readable `upload/` directory. It contains the
approved envelope and structured session projection, bounded credential-redacted
stdout/stderr/session streams and supported run-level proxy projections.
Availability and capture coverage remain explicit; unavailable streams are not
claimed as captured. Protected source permissions are never changed.

Execution and collection outcomes remain separate. Collection rejection fails
its step with upstream's safe `failedCheck`/`category`, while upload still runs
and can publish only `collection-status.txt`. `absent-evidence` is distinct from
an execution failure; it does not establish the underlying cause. An unsafe
prepared scope can prevent even status publication, in which case the collection
error and missing-output upload warning remain visible.

Local workflow assertions and public synthetic collector fixtures can be run
without privileged installation by pointing at the immutable downloaded script:

```bash
AWF_COLLECTOR_PATH=/path/to/collect-enclave-smoke-debug.cjs \
  node --test .github/aw/enclave-diagnostics.test.cjs
```

Node bootstrap tests execute the authored isolated Python against temporary
synthetic archives and mapped protected paths without sudo. They cover both
non-`/usr/bin` architecture layouts, archive authentication and unsafe
links/files/ownership/permissions, and preserve the source/lock interpreter
binding. Set `AWF_NODE_ARCHIVE_PATH` to the exact pinned x64 release archive to
also exercise real archive authentication and extraction without execution.

The fixture test verifies that script's exact SHA-256. The v0.29.5 upgrade passed
all 11 focused tests on macOS, including 19 isolated Node bootstrap cases and
11 public collector acceptance/rejection cases. Two official v1.0.1 compile/inject
passes reproduced an identical lock; bridge `--check` also passed.
Linux `/proc/self/fd` dispatcher tests, privileged helper installation and
native Docker loading were not exercised on macOS. No hosted execution or
artifact upload was dispatched or verified. A controlled eligible Docker failure,
hosted native loading and hosted upload remain the end-to-end acceptance gap. The earlier
[run](https://github.com/githubnext/gh-aw-enclave-demo-public/actions/runs/41232538301)
does not prove an underlying execution cause or exact custom-exporter mismatch.

Do not dispatch either demo without approval: both post public comments, and
the unchanged vulnerable workflow still accesses a private repository.
