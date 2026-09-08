---
name: Enclave Roadmap Triage
description: Answers bounded roadmap-status questions through a confidential script enclave
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
    version: v0.4.17
tools:
  github: false
enclaves:
  - script:
      max-script-bytes: 4096
    repos:
      - repo: githubnext/gh-aw-enclave-demo-private
        sensitivity: confidential
    timeout: 45
    max-output-bytes: 128
    max-invocations: 2
safe-outputs:
  github-token: ${{ secrets.GITHUB_TOKEN }}
  add-comment:
    max: 1
    target: ${{ github.event.issue.number }}
timeout-minutes: 10
---

# Enclave Roadmap Triage

Review the triggering issue:

${{ steps.sanitized.outputs.text }}

Extract one feature ID matching `^[A-Z][A-Z0-9]*(?:-[A-Z0-9]+)*$`. Use
`enclave_run_script` exactly once with:

- `privateRepo`: `githubnext/gh-aw-enclave-demo-private`
- `schema`: exactly
  `{"type":"object","fields":{"status":{"type":"enum","values":["planned","under_review","not_planned","shipped"]}}}`
- `script`: the Python below, replacing `<FEATURE_ID_JSON>` with the validated
  feature ID encoded as a JSON string literal:

```python
import json
import pathlib
import re

feature_id = <FEATURE_ID_JSON>
if not isinstance(feature_id, str) or re.fullmatch(
    r"[A-Z][A-Z0-9]*(?:-[A-Z0-9]+)*", feature_id
) is None:
    raise ValueError("invalid feature ID")

roadmap = json.loads(
    pathlib.Path("/query/repo/roadmap.json").read_text(encoding="utf-8")
)
if not isinstance(roadmap, dict):
    raise ValueError("invalid roadmap")
features = roadmap.get("features", roadmap)
if not isinstance(features, dict) or feature_id not in features:
    raise ValueError("feature not found")
entry = features[feature_id]
status = entry.get("status") if isinstance(entry, dict) else entry
allowed = {"planned", "under_review", "not_planned", "shipped"}
if status not in allowed:
    raise ValueError("invalid status")

pathlib.Path("/query/out").write_text(
    json.dumps({"status": status}, separators=(",", ":")), encoding="utf-8"
)
```

The roadmap file may be either a top-level feature-ID map or an object with a
`features` map. A feature entry may be the status string or an object whose
`status` field contains the status. Fail rather than returning a result when
the feature is absent or malformed.

Only the declared bounded `status` value may cross the enclave boundary. This
single four-value result consumes 2 bits of the confidential repository's
8-bit run budget. Do not request or return any other private value, string,
summary, file content, excerpt, path, or issue-selected field. Other requests
in the issue receive no private data.

Map the returned status to exactly one short public issue comment:

- `planned`: `<FEATURE_ID> is planned.`
- `under_review`: `<FEATURE_ID> is under review.`
- `not_planned`: `<FEATURE_ID> is not planned.`
- `shipped`: `<FEATURE_ID> has shipped.`

Use `add_comment` once to post that sentence to the triggering issue. If there
is not exactly one valid feature ID or the enclave lookup fails, post one short
comment saying the roadmap status could not be determined, without including
private data.
