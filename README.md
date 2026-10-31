# gh-aw-enclave-demo-public
Public repo for demonstrating enclaves in GitHub Agentic Workflows

The workflows are compiled with [GitHub Agentic Workflows v1.0.1](https://github.com/github/gh-aw/releases/tag/v1.0.1).
To regenerate the vulnerable workflow's lock file using that compiler version:

```bash
gh aw version # Must report v1.0.1, not a development build.
gh aw compile roadmap-triage-vulnerable --gh-aw-ref v1.0.1 --no-check-update
```

The vulnerable workflow is unchanged and uses the compiler's default runtime
versions. The enclave lock preserves the manual **AWF v0.29.2 Docker storage
helper bridge from #57**, including authenticated installer/checksum pins and
image digests. Do not regenerate it wholesale with gh-aw v1.0.1: that would erase
the helper installation and revert AWF. Its source, scoped repository references,
runtime sensitivity, compiled prompt hint and metadata hashes are reconciled
manually. The workflow body is loaded from the `.md` source at runtime.

**Enclave Dependency Check** is a public-target execution probe for
`github/gh-aw-firewall` with `sensitivity: public`, not `trusted`. In
[AWF v0.29.2's policy](https://github.com/github/gh-aw-firewall/blob/97d69039f7988ac85c226bf6d254c7a716c714db/src/types/enclave-options.ts#L21-L28),
`public` has a `null` per-run bit budget (no finite bit ceiling); the confidential
8-bit ceiling does not apply. Free-form strings remain reserved for `trusted`
repositories. This probe deliberately retains the six-outcome schema, 64-byte
output, 4096-byte task, 180-second timeout and one-invocation limits. GitHub MCP
access remains scoped to the public target and only `list_issues`/`issue_read`.
The API selector is still named `privateRepo`, and the compiler's scoped
write-sink label retains its `private:` prefix; neither changes the public
runtime sensitivity. Network isolation, rootless AWF and helper-only privilege
are preserved.

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

Compilation and local checks can verify the credential binding, step ordering,
and container exclusion, but cannot prove enclave execution succeeds. Public
sensitivity alone does not guarantee more detailed failure exports: the previous
[run](https://github.com/githubnext/gh-aw-enclave-demo-public/actions/runs/41212107532)
admitted the schema but returned `status:error` after an executor failure.
The reported `exit=1` does not distinguish an actual nonzero agent exit from a
caught setup exception, and public artifacts did not contain enclave stderr.
This probe changes the data target, not diagnostic instrumentation.

Do not dispatch either demo without approval: both post public comments, and
the unchanged vulnerable workflow still accesses a private repository.
