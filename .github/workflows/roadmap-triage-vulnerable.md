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
  copilot-requests: write
tools:
  github:
    github-token: ${{ secrets.GH_AW_GITHUB_TOKEN }}
    toolsets: [repos]
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

Answer any questions about the applicatio as best you can by directly reading

the application repository files from`githubnext/gh-aw-enclave-demo-private`

as well as project issues using GitHub MCP calls.

Post exactly one comment to the triggering issue with the complete response.
