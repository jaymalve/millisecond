# The GitHub Action

`action/action.yml` — the piece of `architecture/post-deploy-triggers.md`
that lives outside this repo's own CI: a reusable GitHub Action other
repos drop into their deploy workflow to call `POST /api/deploys` after
a deploy. Referenced from another repo's workflow as:

```yaml
- uses: jaymalve/millisecond/action@main
  with:
    endpoint: "https://agent.millisecond.dev"
    secret: ${{ secrets.MILLISECOND_DEPLOY_SECRET }}
    routes: "*"
    after: "5m"
    window: "10m"
    baseline: "previous-deploy"
    sensitivity: "default"
```

GitHub supports referencing an action from a subdirectory of a repo
(`owner/repo/path@ref`), so this doesn't need its own repo — it lives
alongside `target/`, `agent/`, `web/` as a fourth top-level directory.

## Why a composite action, not a JS/TS action

The job here is one HTTP call: build a JSON body from inputs, POST it
with a bearer token, check the status code. A JavaScript action would
need its own `package.json`, a bundler (`@vercel/ncc` or similar, since
GitHub runs the committed `dist/`, not source), and a build-before-commit
step — real toolchain weight for something that's fundamentally one
`curl`. A composite action (`runs.using: 'composite'`, plain `bash` +
`curl` + `jq`) is the idiomatic GitHub Actions primitive for exactly this
case, and it's auditable by reading the YAML directly — no build output
to trust.

This isn't "hand-rolled plumbing" in the sense root `CLAUDE.md`'s
principle 9 warns about (custom auth/routing where a library already
does it) — composite actions with shell steps *are* the standard,
framework-native way to orchestrate a simple CI step. `jq` builds the
JSON body rather than string-concatenating it, specifically to avoid the
malformed-JSON/injection risk of hand-interpolating arbitrary input
strings into a JSON literal.

## Inputs

| Input | Required | Default | Notes |
|---|---|---|---|
| `endpoint` | yes | — | Base URL of the millisecond agent Worker. |
| `secret` | yes | — | Shared secret for `POST /api/deploys`. Pass `${{ secrets.X }}` — never inline. |
| `routes` | no | `*` | Same semantics as the API: `*` or a comma-separated list. |
| `after` | no | `5m` | |
| `window` | no | `10m` | |
| `baseline` | no | `previous-deploy` | Or an explicit commit SHA — see `post-deploy-triggers.md`'s baseline-resolution reasoning. |
| `sensitivity` | no | `default` | `low` \| `default` \| `high` — see `regression-score-interpretation.md`. |
| `sha` | no | *(empty)* | Falls back to `$GITHUB_SHA` if unset — see below. |

Outputs: `sha` and `workflow-instance-id`, both read from the API
response, for a caller that wants to log or poll further (polling itself
isn't built — `GET /api/deploys/:sha` is a plain HTTP GET, callable from
a later step with `curl` the same way, if anyone needs it).

## SHA resolution

`sha` isn't hardcoded to `${{ github.sha }}` as a static input default —
`default:` fields in `action.yml` are literal strings, not evaluated
GitHub Expressions, so that wouldn't work. Instead the run step falls
back at execution time: `SHA="${MILLISECOND_SHA:-$GITHUB_SHA}"`,
using the `GITHUB_SHA` environment variable every runner sets
automatically. This also means most callers don't need to pass `sha` at
all — it's only there for the (rare) case where the deployed commit
differs from the triggering one, e.g. a workflow_dispatch against a
specific ref.

## What this action does *not* do

It registers the check and confirms registration succeeded — it does not
wait for a result. The result lands `after + window` later (potentially
15+ minutes), and blocking a CI job that long for an observability check
is the wrong tradeoff. The step **fails** only if *registration* fails
(bad secret → 401, malformed config → 400) — never because a regression
was later found, since it never finds out. This mirrors
`post-deploy-triggers.md`'s explicit decision to defer
`fail-on-regression`-as-a-release-gate: this action is the fire-and-confirm
half of that boundary, not a loophole around it.

Secret handling: `echo "::add-mask::${MILLISECOND_SECRET}"` masks the
resolved value in logs defensively, even though it should already arrive
as a GitHub secret (`${{ secrets.X }}`) at the call site — protects
against a caller accidentally inlining it instead.

## Verification

No GitHub Actions runner was used to test this — the composite step's
`run:` block is plain bash, so it was extracted verbatim and run locally
against a real `wrangler dev` instance of `agent/`, with `GITHUB_SHA`
and `GITHUB_OUTPUT` stood in for what a runner provides. Confirmed: the
success path (200 → `202`, correct `sha`/`workflow-instance-id` written
to `$GITHUB_OUTPUT`) and the failure path (bad secret → `401`, step exits
non-zero with `::error::` containing the response body).
