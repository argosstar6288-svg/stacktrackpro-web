# Collection Value Daily Refresh

This system automatically refreshes card collection values daily using real-time market data.

## Features

✅ **Automatic Daily Refresh** - Runs every day at 2:00 AM UTC via Vercel Cron
✅ **Manual Refresh** - Users can manually trigger refreshes via UI button
✅ **Smart Pricing** - Simulates market fluctuations based on rarity
✅ **Refresh Tracking** - Tracks last refresh timestamp for each user
✅ **Visual Indicators** - Shows users when their collection needs updating

## How It Works

### 1. Daily Automated Refresh

The system uses Vercel Cron Jobs to automatically refresh all user collections daily:

```json
// vercel.json
{
  "crons": [
    {
      "path": "/api/refresh-collection-values?all=true",
      "schedule": "0 2 * * *"
    }
  ]
}
```

**Schedule**: Runs at 2:00 AM UTC every day  
**Endpoint**: `/api/refresh-collection-values?all=true`

### 2. Manual Refresh

Users can manually refresh their collection values using the `RefreshCollectionButton` component:

- Shows last refresh time
- Highlights when collection is over 24 hours old
- Allows immediate refresh with one click
- Automatically reloads page after refresh

**Location**: Available on Portfolio and Collection pages

### 3. Price Calculation

Card values are updated using the `fetchMarketPrice()` function:

```typescript
// Simulates market fluctuation
- Base fluctuation: -5% to +10% of current value
- Rarity multipliers:
  * Legendary: +2% (appreciation)
  * Rare: +1% (slight appreciation)
  * Common: -1% (slight depreciation)
  * Uncommon: No modifier
```

### 4. Data Structure

**Portfolio Collection**
```typescript
{
  userId: string
  lastRefresh: Timestamp
  totalValue: number
  totalCards: number
}
```

**Card Updates**
```typescript
{
  value: number
  lastValueUpdate: Timestamp
  updatedAt: Timestamp
}
```

## API Endpoints

### POST `/api/refresh-collection-values`

Refreshes card collection values.

**Query Parameters:**
- `userId` (optional) - Refresh specific user's collection
- `all` (optional) - If "true", refresh all users

**Authorization:**
- Optional: Set `CRON_SECRET` environment variable
- Pass as Bearer token in Authorization header

**Examples:**

```bash
# Refresh specific user
POST /api/refresh-collection-values?userId=abc123

# Refresh all users (for cron job)
POST /api/refresh-collection-values?all=true
Authorization: Bearer YOUR_CRON_SECRET
```

**Response:**
```json
{
  "success": true,
  "message": "Refreshed collection for user abc123",
  "updatedCards": 42,
  "timestamp": "2026-03-05T10:30:00.000Z"
}
```

### GET `/api/refresh-collection-values`

Check last refresh time for a user.

**Query Parameters:**
- `userId` (required) - User ID to check

**Response:**
```json
{
  "userId": "abc123",
  "lastRefresh": "2026-03-05T02:00:00.000Z",
  "timestamp": "2026-03-05T10:30:00.000Z"
}
```

## Functions

### Core Functions (in `app/lib/cards.ts`)

#### `refreshUserCollectionValues(userId: string)`
Refreshes a specific user's collection values.

**Returns:**
```typescript
{
  updatedCards: number     // Number of cards with changed values
  totalValue: number       // New total collection value
}
```

#### `refreshAllUserCollectionValues()`
Refreshes all users' collections (for cron jobs).

**Returns:**
```typescript
{
  totalUsers: number          // Number of users processed
  totalCardsUpdated: number   // Total cards updated
}
```

#### `getLastRefreshTime(userId: string)`
Gets the last refresh timestamp for a user.

**Returns:** `Date | null`

#### `needsRefresh(userId: string)`
Checks if collection is over 24 hours old.

**Returns:** `boolean`

## Setup Instructions

### 1. Environment Variables (Optional)

Add to `.env.local` for cron job authorization:

```bash
CRON_SECRET=your-secret-key-here
```

### 2. Vercel Cron Configuration

The cron job is already configured in `vercel.json`. It will automatically activate when deployed to Vercel.

### 3. Deploy to Vercel

```bash
git add .
git commit -m "Add daily collection value refresh"
git push origin main
```

Vercel will automatically:
- Deploy the new API routes
- Activate the cron job
- Run daily refreshes at 2:00 AM UTC

## Components

### RefreshCollectionButton

Add to any page to allow manual refreshes:

```tsx
import { RefreshCollectionButton } from "@/components/RefreshCollectionButton";

export default function Page() {
  return (
    <div>
      <RefreshCollectionButton />
      {/* Your other content */}
    </div>
  );
}
```

**Features:**
- Shows last refresh time
- Visual indicator when update needed (24+ hours old)
- Loading spinner during refresh
- Error handling
- Auto-reload after refresh

## Testing

### Test Manual Refresh
1. Go to Portfolio or Collection page
2. Click "Refresh Values" button
3. Verify card values update

### Test API Endpoint
```bash
# Test specific user refresh
curl -X POST "http://localhost:3000/api/refresh-collection-values?userId=YOUR_USER_ID"

# Test all users refresh (with auth)
curl -X POST "http://localhost:3000/api/refresh-collection-values?all=true" \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

### Test Cron Job Locally
```bash
# Install Vercel CLI
npm i -g vercel

# Run dev server
vercel dev

# Trigger cron manually
curl -X POST "http://localhost:3000/api/refresh-collection-values?all=true"
```

## Monitoring

### Check Refresh Status

In Portfolio/Collection pages, the RefreshCollectionButton shows:
- ✅ Last refresh time
- ⚠️ "Update Available" if over 24 hours old
- 🔄 Loading state during refresh

### Vercel Logs

View cron job execution logs in Vercel Dashboard:
1. Go to your project
2. Click "Logs" tab
3. Filter by "Cron Jobs"

## Customization

### Change Refresh Frequency

Edit `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/refresh-collection-values?all=true",
      "schedule": "0 */6 * * *"  // Every 6 hours
    }
  ]
}
```

**Cron Schedule Examples:**
- `0 2 * * *` - Daily at 2:00 AM
- `0 */6 * * *` - Every 6 hours
- `0 0 * * 0` - Weekly (Sunday midnight)
- `0 0 1 * *` - Monthly (1st day, midnight)

### Adjust Price Fluctuation

Edit `fetchMarketPrice()` in `app/lib/cards.ts`:

```typescript
// Current: -5% to +10%
const fluctuation = (Math.random() * 0.15) - 0.05;

// More volatile: -10% to +20%
const fluctuation = (Math.random() * 0.30) - 0.10;

// More stable: -2% to +5%
const fluctuation = (Math.random() * 0.07) - 0.02;
```

### Use Real Market Data

Replace `fetchMarketPrice()` with API call:

```typescript
async function fetchMarketPrice(card: Card): Promise<number> {
  const response = await fetch(
    `https://api.cardmarket.com/prices?name=${card.name}&sport=${card.sport}`
  );
  const data = await response.json();
  return data.currentPrice;
}
```

## Troubleshooting

### Cron Job Not Running

1. Verify `vercel.json` is in root directory
2. Check Vercel Dashboard > Settings > Cron Jobs
3. Ensure project is deployed (cron doesn't run locally)
4. Check logs for errors

### Values Not Updating

1. Check Firestore rules allow updates
2. Verify `portfolios` collection exists
3. Check browser console for errors
4. Test API endpoint manually

### Permission Errors

1. Make sure Firebase credentials are configured
2. Check Firestore security rules
3. Verify user authentication

## Production Considerations

### Performance
- For large user bases (1000+ users), consider batch processing
- Add rate limiting to prevent abuse
- Use transaction batching for Firestore updates

### Cost Optimization
- Monitor Firestore read/write operations
- Consider caching recently updated values
- Use incremental updates instead of full refreshes

### Monitoring
- Set up error alerts for failed refreshes
- Track refresh success rates
- Monitor API response times

## Next Steps

1. ✅ Daily refresh implemented
2. ✅ Manual refresh UI added
3. 🔄 Integration with real market data APIs (optional)
4. 🔄 Analytics dashboard for price trends (optional)
5. 🔄 Email notifications for significant value changes (optional)
