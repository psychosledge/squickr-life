# Deployment Options for Squickr Life

**Date:** 2026-01-29  
**Current Status:** Deployed on Netlify (running out of free tier)  
**Domain:** squickr.com (owned, placeholder page)  
**Goal:** Deploy to squickr.com with low/no cost hosting

---

## Current Situation

**Current Deployment:**
- Platform: Netlify
- Issue: Running out of free deployments
- Domain: squickr.com (not yet connected to app)

**App Architecture:**
- Frontend-only (Vite + React)
- No backend server required (yet)
- Data stored in IndexedDB (client-side)
- Future: Backend sync with Supabase + Google OAuth

---

## Low/No Cost Deployment Options

### Option 1: GitHub Pages ✅ RECOMMENDED (Best for MVP)

**Cost:** FREE (unlimited for public repos)

**Pros:**
- ✅ Completely free
- ✅ Custom domain support (squickr.com)
- ✅ Automatic deployments via GitHub Actions
- ✅ HTTPS included
- ✅ Great for static sites (perfect for current app)
- ✅ No build minute limits
- ✅ Easy integration (already on GitHub)

**Cons:**
- ❌ Static hosting only (no serverless functions)
- ❌ Public repo required for free tier
- ❌ 1GB storage limit (fine for static assets)
- ❌ 100GB/month bandwidth limit (plenty for MVP)

**Setup Steps:**
1. Build app: `pnpm build` in packages/client
2. Configure custom domain (squickr.com) in repo settings
3. Add GitHub Actions workflow for auto-deploy
4. Update DNS records to point to GitHub Pages

**Perfect for:** Current state (frontend-only, IndexedDB storage)

**Migration to backend:** When ready for Supabase, can add backend elsewhere (Vercel, Cloudflare Workers) and keep frontend on GitHub Pages, OR migrate everything to Option 2/3.

---

### Option 2: Vercel Free Tier

**Cost:** FREE (with limits)

**Limits:**
- 100GB bandwidth/month
- 100 deployments/month (more than Netlify)
- Serverless functions included (6000 GB-hours)
- Unlimited static hosting

**Pros:**
- ✅ Free tier is generous
- ✅ Custom domain (squickr.com)
- ✅ Serverless functions (good for future backend)
- ✅ Automatic deployments from GitHub
- ✅ HTTPS included
- ✅ Edge network (fast globally)
- ✅ Easy Supabase integration

**Cons:**
- ❌ 100 deployment limit (better than Netlify but still limited)
- ❌ Commercial use technically requires Pro plan ($20/mo)

**Perfect for:** When you add Supabase backend (serverless functions for API routes)

---

### Option 3: Cloudflare Pages + Workers

**Cost:** FREE (very generous limits)

**Limits:**
- Unlimited bandwidth
- Unlimited deployments
- 100,000 requests/day (Workers free tier)
- 500 builds/month

**Pros:**
- ✅ Most generous free tier
- ✅ Custom domain (squickr.com)
- ✅ Cloudflare Workers for serverless (when needed)
- ✅ Automatic deployments from GitHub
- ✅ HTTPS included
- ✅ Global CDN (blazing fast)
- ✅ No commercial use restrictions

**Cons:**
- ❌ Slightly more complex setup than Vercel/Netlify
- ❌ Workers have 10ms CPU time limit (can be challenging for complex logic)

**Perfect for:** Long-term hosting with backend (Workers for API, Pages for frontend)

---

### Option 4: Netlify (Stay, Optimize Usage)

**Cost:** FREE (with careful usage)

**Current Issue:** Running out of free deployments (300/month)

**Optimization Strategies:**
- Only deploy from `master` branch (disable preview builds)
- Use manual deploys instead of auto-deploy
- Reduce commit frequency before deploying

**Pros:**
- ✅ Already set up
- ✅ Familiar workflow

**Cons:**
- ❌ Still limited to 300 builds/month
- ❌ Problem will persist

**Not recommended:** You'll hit limits again. Better to migrate.

---

## Recommendation

### For Current State (Frontend-Only):

**Use GitHub Pages** 🏆

**Why:**
- Completely free, no limits that matter
- Perfect for static frontend apps
- Easy setup (you're already on GitHub)
- Custom domain support (squickr.com)
- When you add backend, can migrate or add separately

**Setup Time:** ~1 hour

### For Future State (With Supabase Backend):

**Two Options:**

**Option A: Cloudflare Pages + Workers** (Best long-term)
- Free forever, very generous limits
- Workers for API/auth logic
- Pages for frontend
- All in one platform

**Option B: GitHub Pages (frontend) + Supabase (backend)**
- Frontend stays on GitHub Pages (free)
- Backend on Supabase (free tier: 500MB DB, 50k monthly active users)
- Separate but works well together

---

## Migration Strategy: Data Preservation

### Your Question: Should you wait for backend sync before deploying to squickr.com?

**Short Answer:** NO - Deploy to squickr.com now, data won't be lost.

**Why:**
1. **IndexedDB is browser-based:** Your data is stored in the browser's IndexedDB, not tied to the domain
2. **Domain change doesn't affect data:** Moving from netlify.app to squickr.com won't clear IndexedDB
3. **BUT:** If you clear browser data or use a different browser, data is gone (current limitation)

### Migration Path

**Phase 1: Deploy to squickr.com NOW** ✅
- Deploy current app to squickr.com (GitHub Pages or Cloudflare Pages)
- Users can start using it
- Data stored locally in IndexedDB

**Phase 2: Add Backend Sync** (Future)
- Implement Supabase + Google OAuth
- Add sync logic
- Users log in → data syncs to cloud
- From then on, data persists across devices/browsers

**Phase 3: Migration Prompt** (When backend is ready)
- Detect if user has local data but isn't synced
- Prompt: "Sync your data to Google account?"
- One-time upload of existing IndexedDB → Supabase

### Data Migration Code (Future Reference)

```typescript
// When backend sync is ready
async function migrateLocalDataToCloud() {
  const eventStore = new IndexedDBEventStore();
  const localEvents = await eventStore.getAllEvents();
  
  if (localEvents.length > 0) {
    // Show prompt to user
    const shouldMigrate = confirm(
      `You have ${localEvents.length} local entries. 
       Sync to your Google account to access across devices?`
    );
    
    if (shouldMigrate) {
      // Upload to Supabase
      await supabase.from('events').insert(localEvents);
      
      // Mark as synced
      localStorage.setItem('data_migrated', 'true');
    }
  }
}
```

---

## Recommended Timeline

### Immediate (This Week):
1. ✅ Deploy to squickr.com using GitHub Pages
2. ✅ Continue using IndexedDB (local storage)
3. ✅ Start using real domain for development

### Phase 5 (Next 2-4 weeks):
4. Implement Supabase backend
5. Add Google OAuth
6. Add event synchronization
7. Test with your existing local data

### When Backend is Ready:
8. Deploy backend (Cloudflare Workers or Vercel)
9. Add migration prompt for existing users
10. All new users automatically use cloud sync

---

## Cost Comparison

| Platform | Cost | Bandwidth | Builds | Functions | Best For |
|----------|------|-----------|--------|-----------|----------|
| **GitHub Pages** | FREE | 100GB/mo | Unlimited | No | Frontend only |
| **Vercel** | FREE | 100GB/mo | 100/mo | Yes | Frontend + Backend |
| **Cloudflare** | FREE | Unlimited | 500/mo | 100k req/day | Long-term |
| **Netlify** | FREE | 100GB/mo | 300/mo | 125k/mo | Current (limited) |

---

## Action Items

**To deploy to squickr.com now:**

1. Choose platform (GitHub Pages recommended)
2. Configure build output directory
3. Set up custom domain DNS
4. Create deployment workflow
5. Deploy!

**Want me to help set this up?** I can:
- Create GitHub Actions workflow for auto-deploy
- Configure for GitHub Pages
- Provide DNS instructions for squickr.com

Let me know if you want to proceed! 🚀

---

## References

- **GitHub Pages:** https://pages.github.com/
- **Vercel Pricing:** https://vercel.com/pricing
- **Cloudflare Pages:** https://pages.cloudflare.com/
- **Supabase Pricing:** https://supabase.com/pricing
