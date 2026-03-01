# Pro / Admin Role Management System

## Overview

Complete role-based access control (RBAC) system with feature-level permissions for StackTrackPro. Users can be assigned roles with specific capabilities tied to their subscription tier.

---

## 📋 Role Hierarchy

```
Free → Pro → Premium
       ↓
    Moderator ← Admin
```

### Roles

| Role | Description | Use Case |
|------|-------------|----------|
| **free** | No-cost tier with basic features | New users, limited testers |
| **pro** | Paid tier with business features | Active traders, content creators |
| **premium** | Top-tier with unlimited features | Power users, professional dealers |
| **moderator** | Enforces community standards | Community managers (by admin) |
| **admin** | Full platform control | Developers, platform owners |

---

## 🔐 Feature Permissions

Each role has different capabilities:

```typescript
interface RoleFeatures {
  canCreateAuctions: boolean;        // Create and manage auctions
  canListCards: number;              // Max cards in portfolio (-1 = unlimited)
  canAccessMarketplace: boolean;     // Access marketplace features
  canAccessAnalytics: boolean;       // View portfolio analytics
  canAccessFolders: boolean;         // Create card folders
  canAccessPortfolioNotes: boolean;  // Add notes to cards
  canAccessAdvancedSearch: boolean;  // Advanced search filters
  can2FA: boolean;                   // Enable 2FA
  canAccessAPI: boolean;             // Use REST API (Premium/Admin only)
  advertisingFree: boolean;          // No ads in platform
  monthlyExportLimit: number;        // Card export limit (-1 = unlimited)
}
```

### Permission Matrix

| Feature | Free | Pro | Premium | Admin | Moderator |
|---------|------|-----|---------|-------|-----------|
| Create Auctions | ❌ | ✅ | ✅ | ✅ | ✅ |
| Max Cards | 100 | 1,000 | Unlimited | Unlimited | Unlimited |
| Marketplace | ✅ | ✅ | ✅ | ✅ | ✅ |
| Analytics | ❌ | ✅ | ✅ | ✅ | ✅ |
| Folders | ❌ | ✅ | ✅ | ✅ | ✅ |
| 2FA | ✅ | ✅ | ✅ | ✅ | ✅ |
| API Access | ❌ | ❌ | ✅ | ✅ | ❌ |
| Ad-Free | ❌ | ✅ | ✅ | ✅ | ✅ |
| Monthly Exports | 0 | 12 | Unlimited | Unlimited | 12 |

---

## 🚀 Usage

### Get User Role

```typescript
import { getUserRole } from "@/lib/roleManager";

const role = await getUserRole("userId123");
console.log(role); // "pro" | "free" | "premium" | "admin" | "moderator"
```

### Check Permissions

```typescript
import { getUserPermissions, hasPermission } from "@/lib/roleManager";

// Get all permissions for user
const permissions = await getUserPermissions("userId123");
console.log(permissions.canCreateAuctions); // true/false

// Check specific permission
const canCreate = await hasPermission("userId123", "canCreateAuctions");
if (canCreate) {
  // Show auction creation feature
}
```

### React Hook - Feature Access

```typescript
"use client";

import { useFeatureAccess } from "@/lib/useFeatureAccess";

export default function CreateAuctionButton() {
  const { permissions, loading } = useFeatureAccess();

  if (loading) return <div>Loading...</div>;

  if (!permissions?.canCreateAuctions) {
    return (
      <button disabled>
        Upgrade to Pro to create auctions
      </button>
    );
  }

  return <button>Create Auction</button>;
}
```

### Feature Gate HOC

```typescript
import { withFeatureGate } from "@/lib/useFeatureAccess";

function AuctionCreator() {
  return <div>Create your auction here...</div>;
}

// Only users with canCreateAuctions permission can see this
export default withFeatureGate(AuctionCreator, "canCreateAuctions");
```

### Role-Based Route Protection

```typescript
import { withRoleProtection } from "@/lib/useRoleBasedRoute";

function AdminDashboard() {
  return <div>Admin content only</div>;
}

// Only admins can access
export default withRoleProtection(AdminDashboard, ["admin"]);

// Allow multiple roles
export default withRoleProtection(AdminDashboard, ["admin", "moderator"]);
```

---

## 👨‍💼 Admin Functions

### Promote User to Admin

```typescript
import { promoteUserToAdmin } from "@/lib/roleManager";

await promoteUserToAdmin("userId123");
```

### Promote User to Moderator

```typescript
import { promoteUserToModerator } from "@/lib/roleManager";

await promoteUserToModerator("userId123");
```

### Revoke Admin/Moderator Status

```typescript
import { revokeAdminStatus } from "@/lib/roleManager";

await revokeAdminStatus("userId123", "free"); // Downgrade to free
```

### Suspend/Unsuspend User Account

```typescript
import { toggleUserSuspension } from "@/lib/roleManager";

// Suspend user
await toggleUserSuspension("userId123", true);

// Unsuspend user
await toggleUserSuspension("userId123", false);
```

### Get All Admins

```typescript
import { getAllAdmins } from "@/lib/roleManager";

const admins = await getAllAdmins();
// Returns: [{ uid, email, firstName, lastName }, ...]
```

### Get All Moderators

```typescript
import { getAllModerators } from "@/lib/roleManager";

const moderators = await getAllModerators();
```

### Get User Statistics

```typescript
import { getUserStats } from "@/lib/roleManager";

const stats = await getUserStats();
// Returns: {
//   totalUsers: 1500,
//   freeUsers: 1200,
//   proUsers: 200,
//   premiumUsers: 50,
//   adminUsers: 5,
//   moderatorUsers: 45
// }
```

### Access Admin Panel

Navigate to `/dashboard/admin` (admin-only page)

Features:
- View user statistics by role
- Search users by email/name
- Filter by role
- Promote users to Admin or Moderator
- Revoke admin status
- Suspend/unsuspend accounts
- Real-time user management

---

## 🔄 User Role Upgrade/Downgrade

### Upgrade User Subscription

```typescript
import { upgradeUserRole } from "@/lib/roleManager";

// Upgrade to Pro
await upgradeUserRole("userId123", "pro");

// Upgrade to Premium
await upgradeUserRole("userId123", "premium");
```

### Downgrade User Subscription

```typescript
import { downgradeUserRole } from "@/lib/roleManager";

// Downgrade to Free
await downgradeUserRole("userId123", "free");
```

---

## 📊 Firestore User Document Structure

```javascript
{
  uid: "userId123",
  email: "user@example.com",
  firstName: "John",
  lastName: "Doe",
  
  // Role & Permissions
  role: "pro", // free | pro | premium | admin | moderator
  customClaims: {
    admin: false,
    moderator: false,
    // ... other custom permissions
  },

  // Subscription Details
  subscription: {
    tier: "pro",
    status: "active",
    renewalDate: 2026-05-21T00:00:00Z,
    stripeCustomerId: "cus_123abc",
    stripeSubscriptionId: "sub_456def"
  },

  // Account Status
  suspended: false,
  suspendedAt: null,
  emailVerified: true,
  onboardingComplete: true,

  // Two-Factor Auth
  twoFactorAuth: {
    enabled: true,
    phoneNumber: "+1234567890",
    method: "sms",
    backupCodes: ["ABC12345", ...]
  },

  // Metadata
  createdAt: 2026-02-21T10:30:00Z,
  updatedAt: 2026-02-21T10:30:00Z
}
```

---

## 🔒 Firestore Security Rules

```firestore
match /users/{userId} {
  // Users can read/write their own profile
  allow read: if request.auth.uid == userId;
  allow update: if request.auth.uid == userId && 
    !request.resource.data.keys().hasAny(['role', 'customClaims', 'suspended']);

  // Only admins can modify roles/claims
  allow update: if request.auth.token.admin && 
    request.resource.data.get('role') != resource.data.get('role');
}

match /admin/{document=**} {
  // Only admins can access admin collections
  allow read, write: if request.auth.token.admin == true;
}
```

---

## 🎯 Common Use Cases

### 1. Hide Pro Feature from Free Users

```typescript
"use client";

import { useFeatureAccess } from "@/lib/useFeatureAccess";

export default function Analytics() {
  const { permissions } = useFeatureAccess();

  if (!permissions?.canAccessAnalytics) {
    return (
      <div style={{ padding: "2rem", textAlign: "center" }}>
        <h2>Premium Feature</h2>
        <p>Upgrade to Pro to view analytics.</p>
        <button onClick={() => router.push("/upgrade")}>
          Upgrade Now
        </button>
      </div>
    );
  }

  return (
    <div>
      <h2>Your Analytics</h2>
      {/* Analytics content */}
    </div>
  );
}
```

### 2. Create Admin-Only Page

```typescript
import { withRoleProtection } from "@/lib/useRoleBasedRoute";
import AdminPanel from "@/components/AdminPanel";

function AdminDashboard() {
  return <AdminPanel />;
}

export default withRoleProtection(AdminDashboard, ["admin"]);
```

### 3. Limit Card Portfolio by Tier

```typescript
"use client";

import { useFeatureAccess } from "@/lib/useFeatureAccess";
import { useUserCards } from "@/lib/cards";

export default function CardCollection() {
  const { permissions } = useFeatureAccess();
  const { cards } = useUserCards();

  const maxCards = permissions?.canListCards || 0;
  const canAddMore = maxCards === -1 || cards.length < maxCards;

  return (
    <div>
      <h2>Your Collection ({cards.length}/{maxCards === -1 ? "∞" : maxCards})</h2>
      
      {!canAddMore && (
        <div style={{ padding: "1rem", backgroundColor: "#fff3cd", borderRadius: "4px" }}>
          You've reached your card limit. Upgrade to add more cards.
        </div>
      )}

      <button disabled={!canAddMore}>
        Add Card
      </button>
    </div>
  );
}
```

### 4. Check Multiple Permissions

```typescript
"use client";

import { useFeatureAccess } from "@/lib/useFeatureAccess";

export default function Dashboard() {
  const { permissions } = useFeatureAccess();

  return (
    <div>
      {permissions?.canCreateAuctions && (
        <section>
          <h2>Create Auction</h2>
          {/* Auction creation form */}
        </section>
      )}

      {permissions?.canAccessAnalytics && (
        <section>
          <h2>Portfolio Analytics</h2>
          {/* Analytics dashboard */}
        </section>
      )}

      {permissions?.canAccessAPI && (
        <section>
          <h2>API Keys</h2>
          {/* API management */}
        </section>
      )}
    </div>
  );
}
```

---

## 📝 Implementation Checklist

- [x] Create roleManager.ts with permission matrix
- [x] Create useFeatureAccess.tsx hook
- [x] Create withFeatureGate HOC
- [x] Create AdminPanel.tsx component
- [x] Create admin dashboard page
- [x] Add role upgrade/downgrade functions
- [ ] Update Firestore security rules
- [ ] Create Stripe webhook for subscription updates
- [ ] Add role selector to user settings
- [ ] Create subscription/upgrade page
- [ ] Add analytics to track feature usage by tier

---

## 🔧 Next Steps

1. **Update Firestore Rules** - Add admin-only collection rules
2. **Integrate Stripe** - Sync subscription changes with user roles
3. **Create Upgrade Page** - Allow users to upgrade subscriptions
4. **Add Feature Analytics** - Track which users use which features
5. **Create Moderator Tools** - Content moderation interface
