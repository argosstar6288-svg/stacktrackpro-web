# Advanced Authentication & Authorization Setup

## Overview

This guide documents the enhanced authentication system for StackTrackPro with:
- ✅ Password strength enforcement
- ✅ Two-factor authentication (2FA)
- ✅ Role-based routing & access control
- ✅ Admin custom claims management
- ✅ Stripe subscription guards
- ✅ Enhanced Firestore user profiles

---

## 1️⃣ Password Strength Enforcement

Password requirements:
- Minimum 8 characters
- At least one uppercase letter (A-Z)
- At least one lowercase letter (a-z)
- At least one number (0-9)
- At least one special character (!@#$%^&* etc)

### Implementation

```typescript
import { validatePasswordStrength, signUp } from "@/lib/auth";

// Validate password
const { isStrong, errors } = validatePasswordStrength(password);

// Sign up automatically validates
try {
  await signUp(email, password, firstName, lastName);
} catch (error) {
  // Error message includes specific requirements not met
  console.log(error.message);
}
```

### UI Example

The signup page (`app/signup/page.tsx`) includes:
- Real-time password strength indicator (visual bar)
- List of failing requirements
- Submit button disabled until password is strong

---

## 2️⃣ Two-Factor Authentication (2FA)

### Setup Functions

```typescript
import { 
  initiate2FA, 
  enable2FA, 
  verify2FACode, 
  disable2FA,
  generateBackupCodes 
} from "@/lib/twoFactor";

// User initiates 2FA setup
await initiate2FA(userId, "sms"); // or "email"

// After receiving verification code
await enable2FA(userId, "123456");

// During login, verify the 2FA code
await verify2FACode(userId, "123456");

// Generate recovery codes
const codes = await generateBackupCodes(userId);

// Disable 2FA
await disable2FA(userId);
```

### Firestore Profile Structure

```javascript
{
  twoFactorAuth: {
    enabled: false,
    phoneNumber: "+1234567890",
    method: "sms", // "sms" or "email"
    setupInProgress: false,
    backupCodes: ["ABC12345", "XYZ67890", ...]
  }
}
```

### Backend Implementation Required

For production, implement Cloud Function for SMS/email verification:

```javascript
// functions/index.js
const twilio = require('twilio');

exports.send2FACode = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new Error("Must be authenticated");
  
  const code = Math.random().toString().slice(2, 8);
  
  // Send via Twilio SMS or SendGrid email
  await twilio.messages.create({
    to: data.phoneNumber,
    body: `Your StackTrackPro verification code: ${code}`
  });
  
  // Store code temporarily in Firestore (15 min TTL)
  await admin.firestore()
    .collection('users').doc(context.auth.uid)
    .update({ '2faCode': code, '2faCodeExpiresAt': Date.now() + 900000 });
  
  return { success: true };
});
```

---

## 3️⃣ Role-Based Routing & Access Control

### Available Roles

```typescript
type UserRole = "admin" | "moderator" | "free" | "pro" | "premium";
```

### Hook Usage

```typescript
import { useRoleBasedRoute } from "@/lib/useRoleBasedRoute";

export default function AdminDashboard() {
  const { userRole, isAuthorized, loading } = useRoleBasedRoute(["admin"]);

  if (loading) return <div>Loading...</div>;
  if (!isAuthorized) return <div>Access denied. Your role: {userRole}</div>;

  return <div>Admin content here</div>;
}
```

### Higher-Order Component (HOC)

```typescript
import { withRoleProtection } from "@/lib/useRoleBasedRoute";

function AdminPanel() {
  return <div>Admin Dashboard</div>;
}

// Protect component - only admins can access
export default withRoleProtection(AdminPanel, ["admin"]);
```

### Firestore User Document

```javascript
{
  uid: "user123",
  email: "user@example.com",
  firstName: "John",
  lastName: "Doe",
  role: "free", // free | pro | premium | admin | moderator
  customClaims: {
    admin: false,
    canCreateAuctions: true,
    canViewAnalytics: false
  }
}
```

---

## 4️⃣ Admin Custom Claims Management

Custom claims are special permissions stored securely in Firebase Auth tokens.

### Backend Cloud Function

```javascript
// functions/index.js
exports.setCustomClaims = functions.https.onCall(async (data, context) => {
  // Verify admin
  if (!context.auth.token.admin) {
    throw new Error("Only admins can set claims");
  }
  
  // Update auth claims (server-side only)
  await admin.auth().setCustomUserClaims(data.uid, {
    admin: data.claims.admin,
    moderator: data.claims.moderator,
    customPermissions: data.claims.permissions
  });
  
  // Also update Firestore for quick access
  await admin.firestore()
    .collection('users').doc(data.uid)
    .update({
      customClaims: data.claims,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
  
  return { success: true };
});
```

### Client-Side Usage

```typescript
import { 
  setCustomClaims, 
  promoteToAdmin,
  promoteToModerator,
  getUserCustomClaims,
  hasPermission 
} from "@/lib/adminClaims";

// Promote user to admin
await promoteToAdmin("userId123");

// Check specific permission
const canManageUsers = await hasPermission("userId123", "canManageUsers");

// Get all claims
const claims = await getUserCustomClaims("userId123");

// Revoke admin role
await revokeAdminRole("userId123");
```

---

## 5️⃣ Stripe Subscription Guard

Protects premium features based on subscription tier.

### Subscription Tiers

```typescript
type SubscriptionTier = "free" | "pro" | "premium";
type SubscriptionStatus = "active" | "canceled" | "past_due" | "incomplete";

interface SubscriptionInfo {
  tier: "free" | "pro" | "premium";
  status: "active" | "canceled" | "past_due" | "incomplete";
  renewalDate: Date | null;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
}
```

### Hook Usage

```typescript
import { useSubscriptionGuard } from "@/lib/useSubscriptionGuard";

export default function PremiumFeature() {
  const { subscription, isAuthorized, loading } = useSubscriptionGuard("pro");

  if (loading) return <div>Loading...</div>;
  
  if (!isAuthorized) {
    return (
      <div>
        <p>This feature requires a Pro subscription.</p>
        <p>Your tier: {subscription?.tier}</p>
        <button onClick={() => router.push("/dashboard/settings")}>
          Upgrade
        </button>
      </div>
    );
  }

  return <div>Premium content...</div>;
}
```

### HOC Usage

```typescript
import { withSubscriptionGuard } from "@/lib/useSubscriptionGuard";

function PremiumDashboard() {
  return <div>Premium analytics here...</div>;
}

// Only users with "premium" tier can access
export default withSubscriptionGuard(PremiumDashboard, "premium");
```

### Firestore Profile Structure

```javascript
{
  subscription: {
    tier: "pro",
    status: "active",
    renewalDate: 2026-05-21T00:00:00Z,
    cancellationDate: null,
    stripeCustomerId: "cus_123abc",
    stripeSubscriptionId: "sub_456def"
  }
}
```

---

## 6️⃣ Enhanced Firestore User Profile

On signup, comprehensive user profile is created:

```javascript
{
  // Identity
  uid: "user123",
  email: "user@example.com",
  firstName: "John",
  lastName: "Doe",

  // Role & Permissions
  role: "free",
  customClaims: {
    admin: false,
    moderator: false,
    canCreateAuctions: true,
    canViewAnalytics: false,
    canManageUsers: false
  },

  // Subscription
  subscription: {
    tier: "free",
    status: "active",
    renewalDate: null,
    cancellationDate: null,
    stripeCustomerId: null,
    stripeSubscriptionId: null
  },

  // Two-Factor Auth
  twoFactorAuth: {
    enabled: false,
    phoneNumber: null,
    method: null,
    setupInProgress: false,
    backupCodes: []
  },

  // Account Status
  emailVerified: false,
  onboardingComplete: false,
  createdAt: "2026-02-21T10:30:00Z",
  updatedAt: "2026-02-21T10:30:00Z"
}
```

---

## 🔐 Firestore Security Rules

Add these rules to your `firestore.rules`:

```firestore
match /users/{userId} {
  // Users can only read/write their own profile
  allow read: if request.auth.uid == userId;
  allow write: if request.auth.uid == userId && 
    (
      // Can only update specific fields
      request.resource.data.keys().hasAny(['firstName', 'lastName', 'role', 'subscription', 'twoFactorAuth']) ||
      (request.auth.token.admin && request.resource.data.keys().hasAny(['role', 'customClaims']))
    );

  // Only admins can modify roles and claims
  allow update: if request.auth.token.admin && 
    request.resource.data.get('role') != resource.data.get('role');
}
```

---

## 📋 Integration Checklist

- [ ] Update auth.ts with password strength & enhanced profiles
- [ ] Create twoFactor.ts with 2FA functions
- [ ] Create useRoleBasedRoute.ts for role protection
- [ ] Create adminClaims.ts for custom claims
- [ ] Create useSubscriptionGuard.ts for subscription protection
- [ ] Update signup page with password strength UI
- [ ] Deploy Cloud Functions for 2FA SMS/email
- [ ] Deploy Cloud Function for setCustomClaims
- [ ] Set up Stripe subscription webhook
- [ ] Update Firestore rules with authorization
- [ ] Test all auth flows end-to-end

---

## 🚀 Next Steps

1. **Deploy Cloud Functions**
   - 2FA code generation & verification
   - Custom claims management
   - Stripe webhook integration

2. **Integrate Stripe**
   - Create checkout session
   - Handle subscription events
   - Manage billing portal

3. **Add 2FA UI**
   - Phone number input component
   - Code verification form
   - Backup codes display

4. **Test All Flows**
   - Sign up with password validation
   - Enable 2FA
   - Upgrade subscription
   - Admin role assignment
