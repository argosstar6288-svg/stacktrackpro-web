# 🔥 Firebase Authentication Setup - CRITICAL STEPS

## Current Status: ❌ Identity Toolkit API Not Enabled

Both signup and login are failing because Google Cloud isn't allowing Firebase Authentication requests.

---

## ✅ STEP 1: Enable Identity Toolkit API

**This is the most important step!**

1. Go to: https://console.cloud.google.com/apis/library/identitytoolkit.googleapis.com?project=stacktrackpro

2. Click the big blue **"ENABLE"** button

3. Wait for it to say "API enabled" (takes 10-30 seconds)

---

## ✅ STEP 2: Remove API Key Restrictions (Temporary - For Testing)

1. Go to: https://console.cloud.google.com/apis/credentials?project=stacktrackpro

2. Find your API key: `AIzaSyCN4I_INUKp1qyqLiATrH0HXFZU4Y5Iumg`

3. Click on it to edit

4. Under **"API restrictions"**:
   - Select **"Don't restrict key"**
   - Click **Save**

5. Under **"Application restrictions"** (optional for now):
   - Select **"None"** for testing
   - Later you can add `localhost` and your production domain

---

## ✅ STEP 3: Verify Firebase Authentication is Enabled

1. Go to: https://console.firebase.google.com/project/stacktrackpro/authentication/providers

2. Make sure **"Email/Password"** shows as **Enabled**

3. If not, click it and toggle **Enable**

---

## ✅ STEP 4: Test Again

1. After enabling Identity Toolkit API, **wait 2-3 minutes** for changes to propagate

2. Go back to: http://localhost:3000/test-auth

3. Try creating an account again

4. You should see ✅ SUCCESS with a User ID

---

## 🔍 Still Not Working?

If it still fails after these steps, check:

### Option A: Try a New API Key
1. Go to: https://console.cloud.google.com/apis/credentials?project=stacktrackpro
2. Click **"+ CREATE CREDENTIALS"** → **API key**
3. Copy the new key
4. Update `.env.local` with the new key
5. Restart dev server

### Option B: Check Billing
1. Go to: https://console.cloud.google.com/billing?project=stacktrackpro
2. Make sure you have a billing account linked (even for free tier)
3. Firebase requires billing to be set up (but won't charge for free tier usage)

---

## 📝 Quick Checklist

- [ ] Identity Toolkit API enabled
- [ ] Cloud Firestore API enabled
- [ ] API key has no restrictions (for testing)
- [ ] Email/Password sign-in method enabled in Firebase
- [ ] Waited 2-3 minutes after making changes
- [ ] Billing account linked to project

---

**Once all steps are complete, authentication should work!**

The error `auth/api-key-not-valid` specifically means Google Cloud is rejecting the API key because the required services aren't enabled.
