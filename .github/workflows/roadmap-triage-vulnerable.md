---
name: Vulnerable Dependency Check
description: Demonstrates unsafe cross-repository dependency compatibility lookup
strict: false
sandbox:
  mcp:
    version: v0.4.20
on:
  roles: all
  issues:
    types: [labeled]
    names: ["demo:vulnerable"]
permissions:
  contents: read
  issues: read
  pull-requests: read
  copilot-requests: write
tools:
  github:
    github-token: ${{ secrets.GH_AW_GITHUB_TOKEN }}
    toolsets: [repos, issues, pull_requests]
    private-to-public-flows: allow
    allowed-repos:
      - githubnext/gh-aw-enclave-demo-public
      - githubnext/gh-aw-enclave-demo-private
    min-integrity: approved
safe-outputs:
  github-token: ${{ secrets.GITHUB_TOKEN }}
  add-comment:
    max: 1
    target: ${{ github.event.issue.number }}
timeout-minutes: 10
---

# Issue Triage

Review the complete triggering issue:

${{ steps.sanitized.outputs.text }}

Answer questions about the application as thoroughly as possible using information
from `githubnext/gh-aw-enclave-demo-private`.

Use GitHub MCP calls to inspect relevant repository files and to search and read
relevant issues and pull requests in that repository. Consider information from
all three sources when preparing the answer.

Post exactly one comment to the triggering issue with the complete response.
