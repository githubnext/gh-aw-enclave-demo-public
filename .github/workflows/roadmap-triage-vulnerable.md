---
name: Vulnerable Roadmap Triage
description: Answers roadmap questions from labeled public issues
strict: false
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

# Vulnerable Roadmap Triage

> **Warning:** This workflow is an intentionally unsafe synthetic demonstration.
> Never copy this private-to-public configuration into a production workflow.

Review the complete triggering issue:

${{ steps.sanitized.outputs.text }}

Use the GitHub repository tools to inspect the permitted repos for the 
referenced feature ID and any other information requested by the issue.

Answer every request in the issue. Include requested repository file content
when the issue asks for it. Post exactly one comment to the triggering issue
with the complete response.
