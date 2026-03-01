# StackTrack Pro - Critical Fixes Implementation Guide

## 🚨 IMMEDIATE ACTION REQUIRED

### Priority 1: Add 18+ Verification for Auctions

**Issue**: Anyone can create auctions without age verification
**Risk**: Legal compliance issue
**Impact**: HIGH

**Fix Location**: `/app/auctions/create/page.tsx`

Add this before the form:

```tsx
useEffect(() => {
  if (user && !user.isAuctionVerified) {
    router.push("/verify-age");
  }
}, [user, router]);
```

**Also create**: `/app/verify-age/page.tsx` with age verification flow

---

### Priority 2: Add Loading States to All Buttons

**Issue**: Users can double-click submit buttons causing duplicate submissions
**Risk**: Data corruption, duplicate charges
**Impact**: HIGH

**Pages to Fix**:
- `/app/auctions/create/page.tsx` - Create auction button
- `/app/dashboard/ai/page.tsx` - Scan card button
- `/app/dashboard/marketplace/create/page.tsx` - Create listing button
- `/app/dashboard/settings/page.tsx` - Save settings button
- `/app/dashboard/collection/add/page.tsx` - Add card button

**Pattern to use**:

```tsx
const [loading, setLoading] = useState(false);

const handleSubmit = async () => {
  setLoading(true);
  try {
    await saveData();
  } finally {
    setLoading(false);
  }
};

<button disabled={loading}>
  {loading ? "Saving..." : "Save"}
</button>
```

---

### Priority 3: Add Scan Limit Enforcement

**Issue**: No limit checking on AI card scanning
**Risk**: Unlimited API usage, high costs
**Impact**: HIGH

**Fix Location**: `/app/dashboard/ai/page.tsx`

Add before scan:

```tsx
import { useFeatureAccess } from "@/lib/useFeatureAccess";

const { scansRemaining, refreshLimits } = useFeatureAccess();

const handleScan = async () => {
  if (scansRemaining === 0) {
    router.push("/dashboard/pricing?reason=scanlimit");
    return;
  }
  
  // ... existing scan logic
  await refreshLimits(); // Update counts after scan
};
```

**Also update**: Show remaining scans in UI

---

### Priority 4: Auth Protection on All Dashboard Pages

**Issue**: Some dashboard pages accessible without login
**Risk**: Unauthorized access to user data
**Impact**: MEDIUM

**Pattern to add to EVERY dashboard page**:

```tsx
useEffect(() => {
  if (!user && !loading) {
    router.push("/login");
  }
}, [user, loading, router]);
```

**Pages to check**:
- ✅ `/app/dashboard/settings/page.tsx` - Already has it
- ⚠️ `/app/dashboard/ai/page.tsx` - Needs checking
- ⚠️ `/app/dashboard/collection/page.tsx` - Needs checking
- ⚠️ `/app/auctions/create/page.tsx` - Has it, needs 18+ too

---

### Priority 5: Add Error Boundaries

**Issue**: Errors crash entire app
**Risk**: Poor user experience
**Impact**: MEDIUM

**Create**: `/app/error.tsx`

```tsx
'use client';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="error-container">
      <h2>Something went wrong!</h2>
      <p>{error.message}</p>
      <button onClick={reset}>Try again</button>
    </div>
  );
}
```

---

## 📋 Quick Implementation Checklist

### Week 1: Critical Fixes
- [ ] Add 18+ verification flow (`/verify-age`)
- [ ] Add loading states to all submit buttons
- [ ] Add scan limit enforcement
- [ ] Test all auth redirects

### Week 2: UX Improvements
- [ ] Add error boundaries
- [ ] Add confirmation modals for destructive actions
- [ ] Add success/error toasts
- [ ] Test all user flows

### Week 3: Testing & Monitoring
- [ ] Test with real users
- [ ] Add analytics tracking
- [ ] Monitor error logs
- [ ] Check system status page daily

---

## 🔨 Code Templates

### Template: Protected Page
```tsx
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useCurrentUser } from "@/lib/useCurrentUser";

export default function ProtectedPage() {
  const router = useRouter();
  const { user, loading } = useCurrentUser();

  useEffect(() => {
    if (!user && !loading) {
      router.push("/login");
    }
  }, [user, loading, router]);

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!user) {
    return null;
  }

  return (
    <div>
      {/* Your page content */}
    </div>
  );
}
```

### Template: Button with Loading
```tsx
const [loading, setLoading] = useState(false);
const [error, setError] = useState("");

const handleAction = async () => {
  setLoading(true);
  setError("");
  
  try {
    await performAction();
    // Success feedback
  } catch (err) {
    setError(err.message);
  } finally {
    setLoading(false);
  }
};

<button 
  onClick={handleAction} 
  disabled={loading}
  className={loading ? "loading" : ""}
>
  {loading ? "Processing..." : "Submit"}
</button>

{error && <p className="error">{error}</p>}
```

### Template: 18+ Verification Check
```tsx
useEffect(() => {
  if (user && !user.isAuctionVerified) {
    router.push("/verify-age?redirect=" + window.location.pathname);
  }
}, [user, router]);
```

---

## 🎯 Testing Script

### Manual Testing Checklist

**As Logged Out User:**
1. Try accessing `/dashboard` → Should redirect to `/login`
2. Try accessing `/auctions/create` → Should redirect to `/login`
3. Try accessing `/dashboard/ai` → Should redirect to `/login`

**As Logged In User (Free Tier):**
1. Scan 5 cards → 5th should prompt upgrade
2. Try creating auction → Should check 18+ verification
3. Click buttons fast → Should not double-submit

**As Premium User:**
1. Scan 50 cards → Should work
2. Create auction → Should work if 18+
3. All features should be accessible

**Admin User:**
1. Access `/dashboard/admin/system-check`
2. Verify all systems show ✅
3. Test one action as regular user

---

## 📊 Success Metrics

After implementing fixes:
- ✅ Zero unauthorized access incidents
- ✅ Zero double-submissions
- ✅ Zero scan limit violations
- ✅ 100% of critical pages protected
- ✅ Load time under 2 seconds
- ✅ Error rate under 1%

---

## 🔗 Quick Links

- System Check: `/dashboard/admin/system-check`
- Button Audit: `/BUTTON_AUDIT.md`
- Implementation Guide: `/CRITICAL_FIXES.md` (this file)

---

**Created**: March 1, 2026
**Priority**: URGENT
**Estimated Time**: 2-3 days
