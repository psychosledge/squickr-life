# Deployment Guide

**Last Updated:** 2026-02-12  
**Current Platform:** GitHub Pages  
**Domain:** squickr.com  
**Status:** ✅ Live in production

---

## Overview

Squickr Life uses a **single-branch workflow** with tag-based releases.

- **Development:** Work directly on `master` branch
- **Production:** Push to `master` triggers automatic deployment
- **Releases:** Tag releases with `git tag v0.x.0` for version tracking
- **Deploy Target:** GitHub Pages at squickr.com

---

## Deployment Workflow

### Step 1: Work on Master Branch

Work directly on the `master` branch:

```bash
git checkout master
# make changes, run tests, commit
git push origin master
```

**Deployment:** Pushing to `master` automatically triggers deployment to production.

---

### Step 2: Tag Releases

When you complete a version, tag it for tracking:

#### 2a. Bump the Version

Edit `package.json` and increment the version:

```json
{
  "version": "0.9.0"  // Was 0.8.0
}
```

**Version Bumping Guidelines:**
- **Major version (1.0.0):** Breaking changes, major milestones
- **Minor version (0.9.0):** New features, enhancements
- **Patch version (0.8.1):** Bug fixes, small tweaks

Also update all package versions to match:
```bash
# Update all packages at once
npm version 0.9.0 --workspaces
```

#### 2b. Commit Version Bump

```bash
git add package.json packages/*/package.json
git commit -m "chore: bump version to 0.9.0"
git push origin master
```

#### 2c. Create Release Tag

```bash
# Create annotated tag with release notes
git tag -a v0.9.0 -m "v0.9.0 - Code Quality & Polish

Features:
- Centralized timezone utilities
- Enhanced test coverage
- ADR-014 documentation

Released: $(date +%Y-%m-%d)
Development Time: ~3 hours
Test Coverage: 1,500+ tests"

# Push tag to remote
git push origin v0.9.0
```

**Tag will trigger deployment** (in addition to the automatic master deployment).

---

## Branch Structure

| Branch | Purpose | Auto-Deploy |
|--------|---------|-------------|
| `master` | Main development and production code | ✅ Yes |

**Notes:**
- ✅ All work happens on `master`
- ✅ Tags track releases (`v0.8.0`, `v0.9.0`, etc.)
- ✅ Continuous deployment on every push

---

## GitHub Actions Workflows

### Deploy to GitHub Pages

**Trigger:** 
- Push to `master` branch
- Push version tag (`v*`)
- Manual workflow dispatch

**Steps:**
1. Checkout code
2. Setup Node.js + pnpm
3. Install dependencies
4. Build production bundle
5. Run tests
6. Deploy to GitHub Pages

**URL:** [squickr.com](https://squickr.com)

---

## Version Management

### Viewing Releases

```bash
# List all release tags
git tag -l

# View tag details
git show v0.8.0

# Checkout specific version
git checkout v0.8.0
```

### GitHub Releases

Tags automatically appear in GitHub Releases section:
- Go to: https://github.com/psychosledge/squickr-life/releases
- Each tag shows commit, date, and release notes

---

## Deployment Checklist

Before pushing to master:

- [ ] ✅ All tests passing (`npm test`)
- [ ] ✅ Build succeeds (`npm run build`)
- [ ] ✅ Version bumped in package.json (if releasing)
- [ ] ✅ CHANGELOG.md updated
- [ ] ✅ Commit message follows convention

---

## Quick Reference

### Standard Release

```bash
# 1. Complete your work
git add .
git commit -m "feat: add new feature"

# 2. Bump version
npm version minor  # or major/patch
git push origin master

# 3. Create release tag
git tag -a v0.9.0 -m "v0.9.0 - Feature Name"
git push origin v0.9.0
```

### Hotfix Release

```bash
# 1. Fix the bug
git add .
git commit -m "fix: resolve critical issue"

# 2. Bump patch version
npm version patch
git push origin master

# 3. Tag hotfix
git tag -a v0.8.1 -m "v0.8.1 - Hotfix: description"
git push origin v0.8.1
```

### Rollback (Emergency)

```bash
# 1. Checkout previous version
git checkout v0.8.0

# 2. Create rollback branch
git checkout -b rollback-to-v0.8.0

# 3. Force push to master (if absolutely necessary)
git push origin rollback-to-v0.8.0:master --force

# 4. Tag as emergency release
git tag -a v0.8.2 -m "v0.8.2 - Emergency rollback"
git push origin v0.8.2
```

**⚠️ Warning:** Force push should be rare and only for critical issues.

---

## Monitoring Deployments

### GitHub Actions

View deployment status:
- Go to: https://github.com/psychosledge/squickr-life/actions
- Filter by "Deploy to GitHub Pages" workflow

### Deployment Logs

```bash
# Using GitHub CLI
gh run list --workflow=deploy.yml

# View specific run
gh run view <run-id> --log
```

### Verify Deployment

```bash
# Check deployed version
curl https://squickr.com | grep version

# Or visit in browser
open https://squickr.com
```

---

## Troubleshooting

### Deployment Failed

1. Check GitHub Actions logs
2. Look for build errors
3. Verify all tests pass locally: `npm test`
4. Check environment variables in GitHub Secrets

### Wrong Version Deployed

1. Tag correct version: `git tag -a v0.x.x <commit-sha>`
2. Push tag: `git push origin v0.x.x`
3. GitHub Pages will deploy from latest push to master

### Cache Issues

GitHub Pages may cache for 5-10 minutes:
- Wait for cache to clear
- Hard refresh in browser (Ctrl+Shift+R)
- Check deployment timestamp in GitHub Actions

---

## Migration Notes

**Previous Workflow:** Two-branch (master → production via PR)  
**Current Workflow:** Single-branch (master with tags)  
**Migration Date:** 2026-02-12

**Changes Made:**
- ✅ Merged production branch into master
- ✅ Updated deploy.yml to deploy from master
- ✅ Removed pr-validation.yml workflow
- ✅ Set master as default branch
- ✅ Archived production branch as `archive/production` tag
- ✅ Created v0.8.0 tag for current release

**Benefits:**
- Simpler workflow (no PRs needed)
- Faster deployments
- Clear version history via tags
- Less cognitive overhead

---

**For questions or issues, see:** [docs/README.md](README.md)
