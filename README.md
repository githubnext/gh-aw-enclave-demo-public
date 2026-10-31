# gh-aw-enclave-demo-public
Public repo for demonstrating enclaves in GitHub Agentic Workflows

The workflows are compiled with [GitHub Agentic Workflows v1.0.1](https://github.com/github/gh-aw/releases/tag/v1.0.1).
To regenerate the checked-in lock files using that compiler version:

```bash
gh aw version # Must report v1.0.1, not a development build.
gh aw compile --gh-aw-ref v1.0.1 --no-check-update
```

Both workflows use the compiler's default AWF and MCP Gateway versions rather
than authored runtime version overrides. Generated security SHA and image digest
pins remain in the lock files. The enclave workflow's scoped GitHub tools use
`GH_AW_GITHUB_MCP_SERVER_TOKEN` or `GH_AW_GITHUB_TOKEN` with read access to the
private repository.

The enclave workflow also requires `GH_AW_GITHUB_TOKEN` with read access to the
private repository for **host-side repository staging**. A `pre-agent-steps`
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
and container exclusion, but cannot prove private-repository staging succeeds.
Do not dispatch either demo without approval: they access private repositories
and post public comments.
