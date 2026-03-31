Ship a new release: run all tests, bump versions, tag, and push.

## Step 1 — Run all tests

```bash
pnpm test
```

If any tests fail, **stop immediately** and report the failures. Do not proceed.

## Step 2 — Determine bump type

Read the current version from `packages/domain/package.json`.

If the user specified a bump type (patch / minor / major) in $ARGUMENTS, use that.
Otherwise, ask the user: "Current version is X.Y.Z — bump patch, minor, or major?"

Wait for their answer before continuing.

## Step 3 — Compute new version

Apply semver bump to the current version:
- patch: Z+1
- minor: Y+1, Z=0
- major: X+1, Y=0, Z=0

## Step 4 — Update all package.json files

Use the Read tool to read each file, then the Edit tool to update the `"version"` field to the new version. Do not use shell commands for this step.

Files to update:
- `packages/domain/package.json`
- `packages/client/package.json`
- `packages/infrastructure/package.json`

## Step 5 — Commit, tag, and push

```bash
git add packages/domain/package.json packages/client/package.json packages/infrastructure/package.json
git commit -m "chore: bump version to <NEW_VERSION>"
git tag v<NEW_VERSION>
git push origin master --tags
```

Report the tag and version that was pushed.
