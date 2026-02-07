# Deployment Guide

**Last Updated:** 2026-02-02  
**Current Platform:** GitHub Pages  
**Domain:** squickr.com  
**Status:** ✅ Live in production

---

## Overview

Squickr Life uses a **PR-based deployment workflow** with automated version validation.

- **Development:** Work freely on `master` branch
- **Production:** Merge to `production` branch triggers deployment
- **Validation:** GitHub Actions ensures version was bumped before deployment
- **Deploy Target:** GitHub Pages at squickr.com

---

## Deployment Workflow

### Step 1: Work on Master Branch

Continue working as normal on the `master` branch:

```bash
git checkout master
# make changes, run tests, commit
git push origin master
```

**Note:** Pushing to `master` does NOT trigger deployment.

---

### Step 2: Prepare for Production Release

When you're ready to deploy changes to production:

#### 2a. Bump the Version

Edit `package.json` and increment the version:

```json
{
  "version": "0.3.0"  // Was 0.2.0
}
```

**Version Convention:**
- **Patch (0.2.0 → 0.2.1):** Bug fixes, minor tweaks
- **Minor (0.2.0 → 0.3.0):** New features, UX improvements
- **Major (0.2.0 → 1.0.0):** Breaking changes, major releases

Commit the version bump:

```bash
git add package.json
git commit -m "chore: bump version to 0.3.0"
git push origin master
```

---

### Step 3: Create Pull Request

1. Go to https://github.com/psychosledge/squickr-life/pulls
2. Click **"New Pull Request"**
3. Set:
   - **base:** `production`
   - **compare:** `master`
4. Add title and description explaining what's being deployed
5. Click **"Create Pull Request"**

---

### Step 4: Automated Validation

GitHub Actions automatically runs the **PR Validation workflow** which:

✅ Runs all tests (`pnpm test`)  
✅ Runs production build (`pnpm build`)  
✅ **Validates version was bumped** (compares `package.json` on production vs PR)  
✅ Posts comment to PR with validation results

**If validation fails:**
- ❌ Version not bumped → Update `package.json` and push to master
- ❌ Tests failing → Fix tests and push to master
- ❌ Build failing → Fix build errors and push to master

**If validation passes:**
- ✅ PR is ready to merge!

---

### Step 5: Merge and Deploy

Once the PR validation passes:

1. Click **"Merge pull request"**
2. Confirm the merge
3. **GitHub Actions automatically deploys to squickr.com** 🚀

**Timeline:**
- Merge → ~2-3 minutes → Live on squickr.com

---

## Verification

### Check Deployed Version

After deployment, visit https://squickr.com and check the version displayed below the tagline:

```
Squickr Life
Get shit done quicker with Squickr!
v0.3.0  ← Should show the new version
```

---

## Branch Strategy

| Branch | Purpose | Deploy? | Push Freely? |
|--------|---------|---------|--------------|
| `master` | Development, work-in-progress | ❌ No | ✅ Yes |
| `production` | Production code, requires PR | ✅ Yes | ❌ No (PR only) |

**Rules:**
- ✅ Push to `master` anytime (no deployment)
- ❌ Never push directly to `production` (use PRs)
- ✅ Only merge to `production` after PR validation passes

---

## GitHub Actions Workflows

### `.github/workflows/pr-validation.yml`

**Trigger:** Pull request to `production` branch  
**Purpose:** Validate PR before allowing merge

**Steps:**
1. Checkout PR branch
2. Install dependencies
3. Run tests
4. Run production build
5. **Check version bump** (fails if version unchanged)
6. Post comment to PR with results

**Key Feature:** Version validation prevents accidental deployments without version bumps.

---

### `.github/workflows/deploy.yml`

**Trigger:** Push to `production` branch (via PR merge)  
**Purpose:** Build and deploy to GitHub Pages

**Steps:**
1. Checkout production branch
2. Install dependencies
3. Run tests
4. Build production bundle
5. Deploy to GitHub Pages (squickr.com)

**Environment Variables:**
- Firebase config secrets (set in GitHub repo settings)

---

## Version Management

### How Versioning Works

**Single Source of Truth:** `package.json`

The version is read from `package.json` at build time and injected into the application:

```typescript
// In the built app
console.log(__APP_VERSION__); // "0.3.0"
```

**No manual updates needed** - just bump `package.json` and the version appears in the UI automatically.

---

### Manual Version Check

To see what version is in each branch:

```bash
# Check master branch version
git show master:package.json | grep version

# Check production branch version  
git show production:package.json | grep version
```

---

## Common Scenarios

### Scenario 1: Forgot to Bump Version

**What happens:**
- Create PR: master → production
- ❌ PR validation fails with "Version not bumped" error
- Bot comments on PR with failure details

**How to fix:**
```bash
# Update version in package.json
git add package.json
git commit -m "chore: bump version to 0.3.0"
git push origin master

# PR automatically re-runs validation
# ✅ Now passes
```

---

### Scenario 2: Tests Fail in PR

**What happens:**
- Create PR: master → production  
- ❌ PR validation fails due to test failures

**How to fix:**
```bash
# Fix the failing tests
# Commit and push to master
git push origin master

# PR automatically re-runs validation
```

---

### Scenario 3: Emergency Hotfix

**Need to deploy quickly:**

```bash
# 1. Make the fix on master
git checkout master
# ... make changes ...
git commit -m "fix: critical bug"

# 2. Bump version (patch)
# package.json: 0.2.0 → 0.2.1
git commit -m "chore: bump version to 0.2.1"
git push origin master

# 3. Create PR immediately
# Go to GitHub → New PR → master → production

# 4. Once validated, merge
# Deploys in ~2-3 minutes
```

---

## Rollback Procedure

If a deployment introduces a critical bug:

### Option 1: Quick Rollback (Revert on Production)

```bash
# 1. Checkout production branch
git checkout production

# 2. Revert the bad merge commit
git revert HEAD -m 1

# 3. Push to production (triggers deployment)
git push origin production

# Reverted version deploys in ~2-3 minutes
```

### Option 2: Fix Forward (Recommended)

```bash
# 1. Fix the bug on master
git checkout master
# ... make fixes ...
git commit -m "fix: resolve production issue"

# 2. Bump version (patch)
git commit -m "chore: bump version to 0.3.1"
git push origin master

# 3. Create PR and merge
# New fixed version deploys
```

---

## First-Time Setup (Already Completed)

This section documents the initial setup for future reference:

### 1. Created `production` Branch
```bash
git checkout -b production
git push origin production
```

### 2. Updated GitHub Pages Settings
- Repo Settings → Pages
- Source: Deploy from a branch
- Branch: `production` / root
- Custom domain: squickr.com

### 3. Configured DNS
- Domain provider: Point squickr.com to GitHub Pages
- CNAME record → `psychosledge.github.io`

### 4. Set Up GitHub Actions
- Created `.github/workflows/pr-validation.yml`
- Updated `.github/workflows/deploy.yml`
- Added Firebase secrets to repo settings

**Status:** ✅ All setup complete

---

## Monitoring

### Check Deployment Status

**GitHub Actions:**
- Go to repo → Actions tab
- View workflow runs
- Check deploy.yml for deployment status

**Live Site:**
- Visit https://squickr.com
- Check version number in UI
- Verify functionality

---

## Troubleshooting

### PR Validation Won't Run

**Possible causes:**
- GitHub Actions disabled → Enable in repo settings
- Workflow file syntax error → Check `.github/workflows/pr-validation.yml`
- Branch protection rules → Check repo settings

---

### Deployment Fails

**Check:**
1. GitHub Actions workflow logs
2. Build errors in log output
3. Firebase secrets configured correctly
4. DNS propagation (can take 24-48 hours initially)

---

### Version Not Updating in UI

**Possible causes:**
- Browser cache → Hard refresh (Ctrl+Shift+R)
- Service worker caching → Clear site data in DevTools
- Build didn't include new version → Check built files in deployment

---

## Cost

**Current Cost:** $0 (FREE)

- GitHub Pages: Free for public repos
- GitHub Actions: 2,000 minutes/month (free tier, plenty for our usage)
- Domain (squickr.com): Paid separately

**No usage limits to worry about** - unlimited deployments, unlimited bandwidth.

---

## Future Considerations

### When Backend is Added

The deployment process stays the same, but:

- May need additional secrets (Supabase keys, etc.)
- Could split frontend/backend deployments
- Same PR-based workflow applies

### Scaling

If traffic grows significantly:
- GitHub Pages handles 100GB/month bandwidth (plenty for now)
- Can migrate to Cloudflare Pages for unlimited bandwidth
- Same workflow principles apply

---

## Historical Context: Platform Selection

**Why GitHub Pages?** (Decision made Jan 2026)

We evaluated several platforms before choosing GitHub Pages:

**Alternatives considered:**
- **Vercel Free Tier:** 100 deployments/month, serverless functions included
- **Cloudflare Pages:** Unlimited bandwidth, most generous free tier
- **Netlify:** Previous platform, hit 300 builds/month limit

**GitHub Pages chosen because:**
- ✅ Completely free, no build limits
- ✅ Perfect for static frontend (current architecture)
- ✅ Custom domain support (squickr.com)
- ✅ Easy integration with existing GitHub workflow
- ✅ No commercial use restrictions

**Migration path:** When backend is added, can either:
1. Keep frontend on GitHub Pages + add backend separately (Cloudflare Workers/Vercel)
2. Migrate everything to Cloudflare Pages (unlimited bandwidth, Workers for API)

---

## Quick Reference

**Deploy to Production:**
```bash
# 1. Bump version in package.json
# 2. Commit and push to master
git add package.json
git commit -m "chore: bump version to X.Y.Z"
git push origin master

# 3. Create PR on GitHub: master → production
# 4. Wait for validation ✅
# 5. Merge PR → Deploys automatically 🚀
```

**Check what's deployed:**
```bash
git show production:package.json | grep version
```

**Visit production:**
https://squickr.com

---

## References

- **GitHub Pages Docs:** https://docs.github.com/en/pages
- **GitHub Actions Docs:** https://docs.github.com/en/actions
- **Semantic Versioning:** https://semver.org/

---

**Questions?** Check workflow files:
- `.github/workflows/pr-validation.yml` - PR validation logic
- `.github/workflows/deploy.yml` - Deployment logic
