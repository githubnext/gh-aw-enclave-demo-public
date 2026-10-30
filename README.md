# gh-aw-enclave-demo-public
Public repo for demonstrating enclaves in GitHub Agentic Workflows

The workflows are compiled with [GitHub Agentic Workflows v1.0.1](https://github.com/github/gh-aw/releases/tag/v1.0.1).
To regenerate the checked-in lock files using that compiler version:

```bash
gh aw compile --gh-aw-ref v1.0.1
```

The enclave workflow pins AWF v0.28.20, the minimum version required by this
compiler for `enclaves[].agent.tools.github`. Its scoped GitHub tools use
`GH_AW_GITHUB_MCP_SERVER_TOKEN` or `GH_AW_GITHUB_TOKEN` with read access to the
private repository; the token is not passed through the agent environment.
