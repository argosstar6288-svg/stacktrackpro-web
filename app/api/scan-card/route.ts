import { NextRequest, NextResponse } from "next/server";
import { initializeApp, getApps } from "firebase/app";
import { getFirestore, doc, getDoc, updateDoc, increment } from "firebase/firestore";

// Initialize Firebase (if not already initialized)
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

let db: any;
if (getApps().length === 0) {
  const app = initializeApp(firebaseConfig);
  db = getFirestore(app);
} else {
  db = getFirestore(getApps()[0]);
}

interface CardScanResult {
  name: string;
  player: string;
  year: number;
  brand: string;
  sport: string;
  condition: string;
  isGraded: boolean;
  gradingCompany?: string;
  grade?: string;
  estimatedValue: number;
  confidence: number;
}

function isProviderQuotaError(errorPayload: any): boolean {
  const code = String(errorPayload?.error?.code || "").toLowerCase();
  const type = String(errorPayload?.error?.type || "").toLowerCase();
  const message = String(errorPayload?.error?.message || errorPayload?.message || "").toLowerCase();

  return (
    code.includes("insufficient_quota") ||
    type.includes("insufficient_quota") ||
    message.includes("exceeded your current quota") ||
    message.includes("insufficient_quota") ||
    message.includes("billing")
  );
}

export async function POST(request: NextRequest) {
  try {
    const { image, userId } = await request.json();

    console.log("[AI Scan] Request received - Processing card scan");
    console.log("[AI Scan] OpenAI API Key Status:", process.env.OPENAI_API_KEY ? "FOUND" : "NOT FOUND");
    console.log("[AI Scan] Key length:", process.env.OPENAI_API_KEY?.length || 0);

    if (!image) {
      return NextResponse.json(
        { error: "No image provided" },
        { status: 400 }
      );
    }

    if (!userId) {
      return NextResponse.json(
        { error: "User ID required" },
        { status: 400 }
      );
    }

    // Check user quota
    try {
      const userRef = doc(db, "users", userId);
      const userDoc = await getDoc(userRef);

      if (userDoc.exists()) {
        const userData = userDoc.data();
        const isLifetime = userData?.subscription?.isLifetime === true;
        const aiScansUsed = userData?.aiScansUsed || 0;
        const FREE_TIER_LIMIT = 50;

        // Check quota for non-lifetime users
        if (!isLifetime && aiScansUsed >= FREE_TIER_LIMIT) {
          return NextResponse.json(
            {
              error: "AI scan limit reached",
              message: `You've used all ${FREE_TIER_LIMIT} free AI scans. Upgrade to Lifetime Plan for unlimited AI scanning, or continue adding cards manually.`,
              quotaExceeded: true,
              scansUsed: aiScansUsed,
              limit: FREE_TIER_LIMIT,
            },
            { status: 403 }
          );
        }

        console.log(
          `[AI Scan] User ${userId} - Lifetime: ${isLifetime}, Scans used: ${aiScansUsed}/${isLifetime ? "∞" : FREE_TIER_LIMIT}`
        );
      }
    } catch (quotaErr) {
      console.error("[AI Scan] Error checking quota:", quotaErr);
      // Continue anyway - don't block on quota check errors
    }

    if (!image) {
      return NextResponse.json(
        { error: "No image provided" },
        { status: 400 }
      );
    }

    if (typeof image === "string" && image.length > 5_000_000) {
      return NextResponse.json(
        { error: "Image too large. Please upload a smaller or cropped photo." },
        { status: 413 }
      );
    }

    // Check for OpenAI API key
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.error("[AI Scan] OpenAI API key not found in environment variables");
      console.error("[AI Scan] Available env keys:", Object.keys(process.env).filter(k => k.includes('OPENAI') || k.includes('API')));
      return NextResponse.json(
        { 
          error: "OpenAI API key not configured",
          message: `AI scanning is not configured for this environment (${process.env.VERCEL_ENV || process.env.NODE_ENV || "unknown"}). Add OPENAI_API_KEY and redeploy.`,
          debug: "OPENAI_API_KEY is missing from environment variables" 
        },
        { status: 500 }
      );
    }

    // Log that we found the API key (but not the value itself for security)
    console.log("[AI Scan] OpenAI API key found, length:", apiKey.length);

    const callVision = async (detail: "high" | "low") => {
      return fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4o",
          messages: [
            {
              role: "system",
              content: `You are an expert sports card identifier with advanced image analysis capabilities. Your job is to systematically scan every part of the card image to extract maximum information.

🔍 SYSTEMATIC SCANNING APPROACH:

1. SCAN TOP-TO-BOTTOM, LEFT-TO-RIGHT:
   - Top border: Look for year, brand logo, set name
   - Left/right borders: Check for player name, team name
   - Center: Focus on player photo, uniform number, team logo
   - Bottom: Look for copyright, manufacturer info, card number

2. FOCUS ON KEY AREAS:
   - Player's jersey/uniform: Number, team name, colors
   - Helmet/cap: Team logo, era indicators
   - Background: Stadium, crowd, design elements reveal era
   - Card borders: Color and style indicate brand/year
   - Text anywhere: Name, position, stats, copyright

3. USE CONTEXT CLUES:
   - Photo quality = era (grainy = vintage, crisp = modern)
   - Card thickness/finish = era
   - Uniform style = approximate year range
   - Logo evolution = specific years
   - Card design patterns = specific brands/sets

4. ENHANCE MENTALLY:
   - Zoom into text areas
   - Increase mental contrast for faded areas
   - Trace partial letterforms to complete words
   - Use surrounding context to fill gaps

5. CROSS-REFERENCE:
   - If you see "Lakers #24" → Could be Kobe Bryant
   - Yankees pinstripes → Yankees player
   - Specific uniform designs → Known year ranges

RETURN FORMAT: ONLY raw JSON - no markdown, no code blocks.

{
  "name": "Descriptive card name with all found info",
  "player": "Player name (or best guess from context)",
  "year": number (or estimated from clues),
  "brand": "Topps/Panini/Upper Deck/Fleer/Donruss/Score/etc",
  "sport": "Baseball|Basketball|Football|Hockey|Soccer|Other",
  "condition": "Poor|Fair|Good|Excellent|Mint",
  "isGraded": boolean,
  "gradingCompany": "PSA/BGS/SGC/CGC or null",
  "grade": "grade number or null",
  "estimatedValue": number in USD,
  "confidence": 0.0-1.0
}

VALUE ESTIMATION GUIDE:
- Vintage stars (pre-1980): $50-$10,000+
- Modern stars (1980-2000): $10-$1,000+
- Current stars: $5-$500+
- Graded cards: 3-20x raw value (PSA 10 = 10-20x)
- Common/unknown: $0.50-$5
- Damaged: Reduce 50-90%

CONFIDENCE GUIDE:
- 0.1-0.2: Almost nothing visible, pure educated guess
- 0.3-0.4: Some elements visible, reasonable guess
- 0.5-0.6: Multiple elements clear, good identification
- 0.7-0.8: Most details clear, confident ID
- 0.9-1.0: Perfect visibility, certain identification

⚡ NEVER give up - examine EVERY pixel for clues. Even reflections, shadows, card edges provide information!`
          },
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: "Analyze this card image systematically. Scan the ENTIRE image from top to bottom, left to right. Zoom mentally into text areas. Look at borders, corners, center, and edges. Extract EVERY piece of visible information - player names, numbers, team logos, years, brands, card numbers, copyright text. Even tiny details are valuable. If text is partially visible, use context to complete it. Return ONLY the JSON object with all information you can extract."
                },
                {
                  type: "image_url",
                  image_url: {
                    url: image,
                    detail
                  }
                }
              ]
            }
          ],
          max_tokens: detail === "high" ? 800 : 600,
          temperature: 0.4,
        }),
      });
    };

    // Call OpenAI Vision API (retry with lower detail if needed)
    let response = await callVision("high");

    if (!response.ok) {
      const error = await response.json();
      console.error("OpenAI API error (high detail):", error);

      response = await callVision("low");
      if (!response.ok) {
        const fallbackError = await response.json();
        console.error("OpenAI API error (low detail):", fallbackError);

        // Provide detailed error feedback
        let userMessage = "Card scanning failed. Please try again.";
        let debugInfo = "";

        if (isProviderQuotaError(fallbackError)) {
          userMessage = "Card scanning is temporarily unavailable due to API billing/quota limits. Please try again later or add cards manually.";
          return NextResponse.json(
            {
              error: "AI scanning is temporarily unavailable",
              message: userMessage,
              providerQuotaExceeded: true,
            },
            { status: 503 }
          );
        }

        // Check for authentication errors
        if (fallbackError?.error?.type === "invalid_request_error" && 
            fallbackError?.error?.message?.includes("API key")) {
          userMessage = "The OpenAI API key appears to be invalid or expired.";
          debugInfo = "Invalid OpenAI API key";
        } else if (fallbackError?.error?.type === "invalid_api_key") {
          userMessage = "The OpenAI API key appears to be invalid.";
          debugInfo = "Invalid API key";
        } else if (fallbackError?.error?.type === "rate_limit_error") {
          userMessage = "Too many requests. Please wait a moment and try again.";
          debugInfo = "Rate limited by OpenAI";
        } else if (fallbackError?.error?.message?.includes("billing")) {
          userMessage = "OpenAI account has billing issues. Please check the OpenAI dashboard.";
          debugInfo = "Billing issue with OpenAI account";
        }

        const message =
          userMessage ||
          fallbackError?.error?.message ||
          fallbackError?.error?.type ||
          "Failed to analyze image";

        console.error(`[AI Scan] Error: ${debugInfo || message}`);

        return NextResponse.json(
          { 
            error: message,
            type: fallbackError?.error?.type 
          },
          { status: 500 }
        );
      }
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content;

    if (!content) {
      return NextResponse.json(
        { error: "No response from AI" },
        { status: 500 }
      );
    }

    // Parse the JSON response, handling potential markdown code blocks
    let result: CardScanResult;
    try {
      // Remove markdown code blocks if present
      const cleanedContent = content
        .replace(/```json\s*/g, "")
        .replace(/```\s*/g, "")
        .trim();
      
      result = JSON.parse(cleanedContent);
    } catch (parseError) {
      console.error("Failed to parse AI response:", content);
      return NextResponse.json(
        { error: "Failed to parse AI response" },
        { status: 500 }
      );
    }

    // Accept anything - set defaults for all missing fields
    // Build name from any available information
    const nameParts = [
      result.player,
      result.year ? String(result.year) : null,
      result.brand,
      result.sport && result.sport !== 'Other' ? result.sport : null
    ].filter(Boolean);
    
    result.name = result.name || (nameParts.length > 0 ? nameParts.join(' ') : 'Sports Card');
    result.player = result.player || 'Unknown Player';
    result.sport = result.sport || "Other";
    result.year = Number(result.year) || new Date().getFullYear();
    result.estimatedValue = Number(result.estimatedValue) || 0;
    result.confidence = Number(result.confidence) || 0.2;
    result.condition = result.condition || "Good";
    result.brand = result.brand || "Unknown";
    result.isGraded = result.isGraded || false;

    // Look up average market value using AI
    try {
      const valueLookup = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4o",
          messages: [
            {
              role: "system",
              content: `You are a sports card pricing expert with access to recent market data. Provide average market values based on actual sales data.

Return ONLY a JSON object with this structure:
{
  "averageValue": number (average market value in USD),
  "priceRange": {"low": number, "high": number},
  "recentSales": string (brief description of recent sales),
  "marketTrend": "Rising|Falling|Stable",
  "dataSource": string (where the pricing data comes from)
}

Base your estimate on:
- Recent eBay sold listings
- PSA/BGS population reports and registry prices
- COMC, StarStock, Alt pricing data
- Major auction house results (Goldin, Heritage, PWCC)
- Condition/grade premiums and discounts
- Current market demand and trends`
            },
            {
              role: "user",
              content: `Look up the average market value for this card:
- Card: ${result.name}
- Player: ${result.player}
- Year: ${result.year}
- Brand: ${result.brand}
- Sport: ${result.sport}
- Condition: ${result.condition}
- Graded: ${result.isGraded ? `Yes (${result.gradingCompany} ${result.grade})` : 'No (raw)'}

Provide accurate pricing based on recent sales data. Be as precise as possible.`
            }
          ],
          max_tokens: 400,
          temperature: 0.2,
        }),
      });

      if (valueLookup.ok) {
        const valueData = await valueLookup.json();
        const valueContent = valueData.choices[0]?.message?.content;
        
        if (valueContent) {
          const cleanedValueContent = valueContent
            .replace(/```json\s*/g, "")
            .replace(/```\s*/g, "")
            .trim();
          
          const priceData = JSON.parse(cleanedValueContent);
          
          // Update the estimated value with the looked-up average
          if (priceData.averageValue && priceData.averageValue > 0) {
            result.estimatedValue = Math.round(priceData.averageValue);
            // Add additional pricing context to confidence
            result.confidence = Math.min(result.confidence + 0.1, 0.95);
          }
        }
      }
    } catch (valueLookupError) {
      // If value lookup fails, continue with the original estimate
      console.log("Value lookup failed, using initial estimate:", valueLookupError);
    }

    // Increment AI scan usage counter
    try {
      const userRef = doc(db, "users", userId);
      await updateDoc(userRef, {
        aiScansUsed: increment(1),
        lastAiScanAt: new Date(),
      });
      console.log(`[AI Scan] Incremented usage counter for user ${userId}`);
    } catch (updateErr) {
      console.error("[AI Scan] Error updating usage counter:", updateErr);
      // Don't block the response if counter update fails
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Card scan error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
