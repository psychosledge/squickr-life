Ship a new release: run all tests, bump versions, tag, and push.

## Step 1 — Run all tests

```bash
pnpm test
```

If any tests fail, **stop immediately** and report the failures. Do not proceed.

## Step 2 — Determine bump type

Read the current version from `package.json` (root).

If the user specified a bump type (patch / minor / major) in $ARGUMENTS, use that.
Otherwise, ask the user: "Current version is X.Y.Z — bump patch, minor, or major?"

Wait for their answer before continuing.

## Step 3 — Compute new version

Apply semver bump to the current version:
- patch: Z+1
- minor: Y+1, Z=0
- major: X+1, Y=0, Z=0

## Step 3.5 — Commit any pending code changes

Before bumping versions, check for uncommitted changes that are not the package.json files:

```bash
git status
```

If any tracked files are modified (other than the 4 package.json files that will be updated in Step 4), stage and commit them now:

```bash
git add -u
git diff --cached --name-only
git commit -m "feat/fix: <brief description of changes>"
```

Use a conventional-commits prefix (`feat:`, `fix:`, `refactor:`, `chore:`, etc.) and write a message that summarises the code changes, not the version bump. If there are no pending changes, skip this step.

## Step 4 — Update all package.json files

Use the Read tool to read each file, then the Edit tool to update the `"version"` field to the new version. Do not use shell commands for this step.

Files to update:
- `package.json` (root — this is what Vite reads for `__APP_VERSION__`)
- `packages/domain/package.json`
- `packages/client/package.json`
- `packages/infrastructure/package.json`

## Step 5 — Commit, tag, and push

```bash
git add package.json packages/domain/package.json packages/client/package.json packages/infrastructure/package.json
git commit -m "chore: bump version to <NEW_VERSION>"
git tag v<NEW_VERSION>
git push origin master --tags
```

## Step 6 — Deploy Firebase Functions (if changed)

Check whether any files under `functions/` changed since the last release tag:

```bash
git diff v<PREVIOUS_VERSION> v<NEW_VERSION> --name-only -- functions/
```

If any files are listed, deploy the functions:

```bash
firebase deploy --only functions
```

If no files changed under `functions/`, skip this step and note that Firebase Functions were not redeployed.

Report the tag, version, and whether Firebase Functions were deployed.
