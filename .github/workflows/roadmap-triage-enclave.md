---
name: Enclave Dependency Check
description: Releases a bounded dependency compatibility result through a confidential agent enclave
strict: false
on:
  roles: all
  issues:
    types: [labeled]
    names: ["demo:enclave"]
permissions:
  contents: read
  issues: read
  copilot-requests: write
env:
  GH_TOKEN: ${{ secrets.GH_AW_GITHUB_TOKEN }}
excluded-env:
  - GH_TOKEN
engine:
  id: copilot
  env:
    GH_TOKEN: ${{ secrets.GH_AW_GITHUB_TOKEN }}
sandbox:
  agent:
    id: awf
    version: v0.28.14
  mcp:
    version: v0.4.20
tools:
  github: false
enclaves:
  - agent:
      model: claude-sonnet-5
      max-task-bytes: 4096
    repos:
      - repo: githubnext/gh-aw-enclave-demo-private
        sensitivity: confidential
    timeout: 180
    max-output-bytes: 64
    max-invocations: 1
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
