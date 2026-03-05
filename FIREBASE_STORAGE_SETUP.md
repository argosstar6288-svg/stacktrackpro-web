# Firebase Storage Setup for Card Images

## Overview
Card images are uploaded to Firebase Storage and stored in Firestore documents with persistent download URLs.

## Current Implementation

### Upload Flow
1. **Manual Upload**: User uploads card photo → File uploaded to Firebase Storage → URL saved in Firestore
2. **AI Scanner**: AI scans card image → Image uploaded to Firebase Storage → URL saved in Firestore
3. **Firebase Paths**: `cards/{userId}/{timestamp}-{cardName}.jpg`

### Database Schema
Card documents in Firestore:
```json
{
  "id": "card-doc-id",
  "userId": "user-123",
  "name": "1952 Mickey Mantle",
  "imageUrl": "https://firebasestorage.googleapis.com/...",
  "player": "Mickey Mantle",
  "sport": "Baseball",
  "year": 1952,
  "brand": "Topps",
  "condition": "Mint",
  "value": 15000,
  "addedAt": "2026-03-04T..."
}
```

### Image Display
- **CardItem Component**: Uses `imageUrl` with fallback chain: `imageUrl` → `photoUrl` → `frontImageUrl` → `thumbnailUrl` → `/placeholder-card.svg`
- **Hover Preview**: On desktop, hovering over a card shows a larger preview (480x680px)
- **Error Handling**: If image fails to load, automatically falls back to placeholder SVG

## Firebase Storage Rules

**⚠️ IMPORTANT: Update Storage Rules in Firebase Console**

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select your project
3. Go to **Storage** → **Rules** tab
4. Replace rules with:

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /cards/{userId}/{allPaths=**} {
      // Allow public read access to card images
      allow read: if true;
      // Allow authenticated users to write to their own cards folder
      allow write: if request.auth != null && request.auth.uid == userId;
    }
    
    match /{allPaths=**} {
      allow read, write: if false;
    }
  }
}
```

5. Click **Publish**

**What these rules do:**
- ✅ Anyone can view card images (no auth required)
- ✅ Authenticated users can only upload to their own `cards/{userId}/` folder
- ❌ No other files can be accessed
- ❌ Unauthenticated users cannot upload

## Testing Image Upload

1. Go to `/dashboard/collection/add`
2. Upload a card photo or scan with AI
3. Check browser console for logs: `[CardItem] Card: ..., ImageURL:`
4. Verify image displays correctly
5. Test hover preview on desktop
6. Verify image persists after page refresh

## Troubleshooting

### Images show placeholder instead of uploaded image
**Causes:**
- Firebase Storage rules are too restrictive
- Image URL in Firestore is incorrect
- Image file was not successfully uploaded

**Solutions:**
1. Check browser console for errors
2. Verify Firebase Storage rules (see above)
3. Check Firestore document - should have `imageUrl` field with full URL
4. Check Firebase Storage → cards folder → verify files exist

### "Access denied" errors in console
- Firebase Storage rules block read access
- Update rules to allow `allow read: if true;`

### Images load but don't display correctly
- Check if image URL is valid: try opening it in new tab
- Verify `object-fit: contain` is applied (CardItem.module.css)
- Check image dimensions are correct in Card interface

## Image Specifications

**Recommended sizes:**
- Max file size: 8MB (enforced in upload form)
- Format: JPEG, PNG, WebP
- Display sizes:
  - Grid thumbnail: 300x420px
  - Hover preview: 480x680px
  - Table row: 80x112px

**Fallback image:**
- Location: `/public/placeholder-card.svg`
- Used when: No image uploaded, upload failed, or image fails to load
- Size: 300x420px SVG vector

## Related Files

- **Upload Logic**: `/app/dashboard/collection/add/page.tsx`
- **Display Component**: `/components/CardItem.tsx`
- **Card Styles**: `/components/CardItem.module.css`
- **Data Model**: `/lib/cards.ts`
- **Firebase Config**: `/lib/firebase.ts`
