# AI Card Scanner Feature

## Overview
The AI Card Scanner uses OpenAI's Vision API (GPT-4o) to automatically identify sports cards from photos and extract detailed information including player name, year, brand, condition, and **accurate market values**. The system performs a two-step analysis: first identifying the card, then looking up average market values from recent sales data.

## Features

### Card Detection
- **Automatic identification** of player name, brand, year, and sport
- **Condition assessment** (Poor, Fair, Good, Excellent, Mint)
- **Graded card detection** - identifies PSA, BGS, SGC, CGC, and other grading companies
- **Grade recognition** - reads the grade score/label from graded cards
- **Market value lookup** - queries recent sales data from multiple sources:
  - eBay sold listings
  - PSA/BGS population reports and registry prices
  - Major marketplaces (COMC, StarStock, Alt)
  - Auction house results (Goldin, Heritage, PWCC)
  - Current market trends and demand

### User Experience
- **Photo capture or upload** - Take a new photo or upload an existing image
- **Image preview** - Review the image before scanning
- **Two-step analysis** - Card identification followed by market value lookup (3-7 seconds total)
- **Auto-fill form** - All detected information automatically populates the add card form
- **Manual editing** - Users can adjust any field before saving

## Setup

### 1. Get an OpenAI API Key
1. Visit https://platform.openai.com/api-keys
2. Sign up or log in
3. Click "Create new secret key"
4. Copy the key

### 2. Configure Environment Variable
Add your OpenAI API key to `.env.local`:
```
OPENAI_API_KEY=sk-your-actual-api-key-here
```

### 3. Restart the Development Server
```bash
npm run dev
```

## Usage

1. Navigate to **Dashboard → Collection → Add Card**
2. Click the **"📷 Scan Card with AI"** button
3. Take a photo or upload an image of the card
4. Click **"Scan Card"** to analyze
5. Review the auto-filled information
6. Adjust any fields if needed
7. Click **"Save Card"** to add to collection

## Tips for Best Results

### Photo Quality
- ✅ Good lighting (natural light works best)
- ✅ Capture the entire card in frame
- ✅ Keep card flat and in focus
- ❌ Avoid glare and reflections
- ❌ Avoid shadows
- ❌ Don't crop edges

### Card Types
- **Raw cards**: Works best with clear text and images
- **Graded cards**: Can read through slabs if text is visible
- **Vintage cards**: May have lower confidence but still functional
- **Modern cards**: Highest accuracy

## Technical Details

### API Endpoint
`POST /api/scan-card`

### Request Format
```json
{
  "image": "data:image/jpeg;base64,..."
}
```

### Response Format
```json
{
  "name": "1952 Topps Mickey Mantle #311",
  "player": "Mickey Mantle",
  "year": 1952,
  "brand": "Topps",
  "sport": "Baseball",
  "condition": "Excellent",
  "isGraded": true,
  "gradingCompany": "PSA",
  "grade": "8",
  "estimatedValue": 75000,
  "confidence": 0.92
}
```

### Confidence Score
- **0.8-1.0**: High confidence - Information is very likely accurate
- **0.5-0.8**: Medium confidence - Information is probably accurate
- **0.3-0.5**: Low confidence - Information may need verification
- **< 0.3**: Very low confidence - Manual entry recommended

## Value Estimation

The AI uses a **two-step process** to provide accurate market values:

### Step 1: Card Identification
First, the AI analyzes the image to identify:
- Player name, brand, year, and sport
- Condition assessment (for raw cards)
- Grading company and grade (for graded cards)

### Step 2: Market Value Lookup
After identification, the AI performs a **secondary lookup** to find average market values based on:

**Data Sources:**
- **eBay sold listings** - Recent completed sales
- **PSA/BGS registries** - Population reports and registry prices
- **Major marketplaces** - COMC, StarStock, Alt pricing data
- **Auction houses** - Goldin, Heritage, PWCC results
- **Market trends** - Current demand and price movements

**Pricing Factors:**
1. **Player popularity and demand**
2. **Card scarcity and year**
3. **Brand/manufacturer prestige**
4. **Condition (for raw cards)**
5. **Grade (for graded cards)**
   - PSA 10/BGS 10: Highest premium
   - PSA 9/BGS 9: High premium
   - PSA 8/BGS 8: Moderate premium
   - Lower grades: Reduced premium

**Accuracy:** The two-step lookup provides more accurate values than single-pass estimation by cross-referencing actual market data. Values are updated based on the most recent sales information available to the AI.

**Note**: While values are based on real market data, they remain estimates. For investment decisions or high-value cards, consult recent sale comps or professional appraisers.

## Limitations

- Requires internet connection for API calls
- Image size limit: 10MB
- Supported formats: JPG, PNG, WEBP
- Works best with clear, well-lit photos
- Some obscure or damaged cards may not be recognized
- Value estimates are approximations, not guarantees

## Cost Considerations

- Uses OpenAI GPT-4o with vision (premium model)
- **Two API calls per scan**: 
  1. Image analysis for card identification
  2. Market value lookup based on identified card
- Each complete scan costs approximately **$0.02-0.04**
- Budget accordingly for heavy usage
- Consider implementing rate limiting for production
- Value lookup can be cached for identical cards to reduce costs

## Troubleshooting

### "Could not identify card details"
- Try a clearer photo with better lighting
- Ensure the entire card is visible
- Check that the card text is readable

### "OpenAI API key not configured"
- Verify your API key is set in `.env.local`
- Make sure to restart the dev server after adding the key
- Check that the key starts with `sk-`

### "Failed to analyze image"
- Check your internet connection
- Verify your OpenAI account has available credits
- Check browser console for detailed error messages

## Future Enhancements

Potential improvements:
- **Direct API integrations** with pricing databases (eBay API, COMC API, PSA Price Guide)
- **Price history tracking** - Show value trends over time for scanned cards
- **Batch scanning** - Analyze multiple cards at once
- **Value caching** - Store looked-up prices to reduce API costs for duplicate cards
- **Save scanned images** to Firebase Storage for reference
- **Scan history** - View all previously scanned cards with original photos
- **Mobile app** with native camera integration
- **Real-time market alerts** - Notify when card values change significantly
- **Comparative analysis** - Compare similar cards and their values
- Scan history and image library
- Mobile app with native camera integration
- Real-time market value updates
