# gh-aw-enclave-demo-public
Public repo for demonstrating enclaves in GitHub Agentic Workflows

The workflows are compiled with [GitHub Agentic Workflows v1.0.1](https://github.com/github/gh-aw/releases/tag/v1.0.1).
To regenerate the checked-in lock files using that compiler version:

```bash
gh aw compile --gh-aw-ref v1.0.1
```

Both workflows use the compiler's default AWF and MCP Gateway versions rather
than authored runtime version overrides. Generated security SHA and image digest
pins remain in the lock files. The enclave workflow's scoped GitHub tools use
`GH_AW_GITHUB_MCP_SERVER_TOKEN` or `GH_AW_GITHUB_TOKEN` with read access to the
private repository; the token is not passed through the agent environment.
