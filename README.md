# gh-aw-enclave-demo-public
Public repo for demonstrating enclaves in GitHub Agentic Workflows

The workflows are compiled with [GitHub Agentic Workflows v1.0.1](https://github.com/github/gh-aw/releases/tag/v1.0.1).
To regenerate the vulnerable workflow's lock file using that compiler version:

```bash
gh aw version # Must report v1.0.1, not a development build.
gh aw compile roadmap-triage-vulnerable --gh-aw-ref v1.0.1 --no-check-update
```

The vulnerable workflow is unchanged and uses the compiler's default runtime
versions. The enclave workflow uses **AWF v0.29.4**, preserving the authenticated
Docker storage helper bridge from #57/#59. Its helper installation and shared
collector lifecycle are now authored in `roadmap-triage-enclave.md`. Regenerate
only that workflow, then apply the checked-in runtime injection:

```bash
gh aw version # Must report the official v1.0.1, not a development build.
gh aw compile roadmap-triage-enclave --gh-aw-ref v1.0.1 --no-check-update
node .github/aw/inject-enclave-runtime.cjs
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
[AWF v0.29.4's policy](https://github.com/github/gh-aw-firewall/blob/9596849bcdcefad2133ed484a97a77afd1baa038/src/types/enclave-options.ts),
`public` has a `null` per-run bit budget (no finite bit ceiling); the confidential
8-bit ceiling does not apply. Free-form strings remain reserved for `trusted`
repositories. This probe deliberately retains the six-outcome schema, 64-byte
output, 4096-byte task, 180-second timeout and one-invocation limits. GitHub MCP
access remains scoped to the public target and only `list_issues`/`issue_read`.
The API selector is still named `privateRepo`, and the compiler's scoped
write-sink label retains its `private:` prefix; neither changes the public
runtime sensitivity. Network isolation and rootless AWF are preserved. Host
elevation is limited to authenticated helper installation/probing and the
upstream collector's installation, preparation and collection.

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
[`collect-enclave-smoke-debug.cjs`](https://github.com/github/gh-aw-firewall/blob/9596849bcdcefad2133ed484a97a77afd1baa038/scripts/ci/collect-enclave-smoke-debug.cjs)
from v0.29.4, which includes
[github/gh-aw-firewall#10930](https://github.com/github/gh-aw-firewall/pull/10930).
The release tag is commit `9596849bcdcefad2133ed484a97a77afd1baa038`, whose parent
is the attested build source `564491e648e022be04aa96b73c1681f13f7544f8`; the
collector is identical in both. Its SHA-256 is
`7722affc5c076d79692d4268a543ef267281424ad4b374eb8f80c24cbec08cae`.
The official installer is pinned to the same commit and independently checksummed.
Both CLI installers authenticate `checksums.txt` and `release-identity.txt`,
bind checksum digest
`a2591185d010b1e220e3642b88d968acf79c119611f47af6c9d653a86d57a2e1`
to `refs/tags/v0.29.4`, and remain rootless. All six AWF image digests are recorded
in the injection source and were verified against the release-attested
`containers.txt` and public GHCR tags.

Before execution, the workflow installs the collector root-owned, mode `0600`,
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

The fixture test verifies that script's exact SHA-256. The released upstream
regression suite passed 181 platform-independent tests on macOS; five tests
requiring Linux `/proc/self/fd` need a Linux runner. No hosted execution or
artifact upload was dispatched or verified. A controlled eligible Docker failure
and hosted upload remain the end-to-end acceptance gap. The earlier
[run](https://github.com/githubnext/gh-aw-enclave-demo-public/actions/runs/41232538301)
does not prove an underlying execution cause or exact custom-exporter mismatch.

Do not dispatch either demo without approval: both post public comments, and
the unchanged vulnerable workflow still accesses a private repository.
