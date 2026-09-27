# Deployment Guide

The PWA is hosted on GitHub Pages at [squickr.com](https://squickr.com). Firebase Cloud Functions live in `functions/` and deploy separately with `firebase deploy --only functions`.

## How Deploys Happen

| Workflow | Trigger | Does |
|----------|---------|------|
| CI Validation (`.github/workflows/ci.yml`) | Push or PR to `master` | Install, build, test. Never deploys |
| Deploy to GitHub Pages (`.github/workflows/deploy.yml`) | Push of a `v*` tag, or manual dispatch | Install, build, test, publish to Pages |

Release with `/ship`. It runs tests, bumps all four `package.json` versions, tags, pushes, and deploys Functions when `functions/` changed since the previous tag.

The build reads Firebase config from `VITE_FIREBASE_*` repository secrets, matching `packages/client/.env.example`.

## Hotfix

Fix on `master` with a regression test, then `/ship` with a patch bump.

## Rollback

- **Fast:** Actions → Deploy to GitHub Pages → Run workflow, and pick the last good tag in "Use workflow from." Pages serves that build until the next tag.
- **Durable:** `git revert` the bad commits on `master`, then `/ship` a patch release.

Functions don't roll back with Pages. Check out the last good tag and run `firebase deploy --only functions` from it.

## Verifying a Deploy

- Workflow status: https://github.com/psychosledge/squickr-life/actions
- Deployed version: the About modal in the app shows the version from the root `package.json`.

## Troubleshooting

- **Deploy failed:** check the workflow log for build or test errors, and confirm the `VITE_FIREBASE_*` secrets are set.
- **Old version still showing:** Pages caches for 5–10 minutes, and the PWA service worker serves the cached shell until it updates. Hard refresh (Ctrl+Shift+R) or reopen the app.
