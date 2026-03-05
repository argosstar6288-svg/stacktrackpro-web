import { NextRequest, NextResponse } from "next/server";
import { refreshAllUserCollectionValues, refreshUserCollectionValues } from "@/lib/cards";

const FIREBASE_WEB_API_KEY = process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyCN4I_INUKp1qyqLiATrH0HXFZU4Y5Iumg";

async function getUidFromIdToken(idToken: string): Promise<string | null> {
  try {
    const response = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${FIREBASE_WEB_API_KEY}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ idToken }),
        cache: "no-store",
      }
    );

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    return data?.users?.[0]?.localId ?? null;
  } catch {
    return null;
  }
}

/**
 * API Route: Daily Collection Value Refresh
 * 
 * This endpoint refreshes card values based on current market data.
 * Can be triggered by:
 * - Vercel Cron Jobs (recommended)
 * - External cron services (e.g., cron-job.org)
 * - Manual trigger from admin panel
 * 
 * Query params:
 * - userId: (optional) Refresh specific user's collection
 * - all: (optional) If "true", refresh all users
 */
export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");
    const refreshAll = searchParams.get("all") === "true";
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    // Protect global refresh endpoint; allow user-specific refresh from UI
    if (refreshAll && cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    let result;

    if (userId) {
      const bearerToken = authHeader?.startsWith("Bearer ")
        ? authHeader.slice("Bearer ".length)
        : null;

      if (!bearerToken) {
        return NextResponse.json(
          { error: "Authentication required" },
          { status: 401 }
        );
      }

      const authenticatedUid = await getUidFromIdToken(bearerToken);

      if (!authenticatedUid) {
        return NextResponse.json(
          { error: "Invalid authentication token" },
          { status: 401 }
        );
      }

      if (authenticatedUid !== userId) {
        return NextResponse.json(
          { error: "Forbidden: user mismatch" },
          { status: 403 }
        );
      }

      // Refresh specific user's collection
      result = await refreshUserCollectionValues(userId);
      return NextResponse.json({
        success: true,
        message: `Refreshed collection for user ${userId}`,
        updatedCards: result.updatedCards,
        timestamp: new Date().toISOString(),
      });
    } else if (refreshAll) {
      // Refresh all users' collections
      result = await refreshAllUserCollectionValues();
      return NextResponse.json({
        success: true,
        message: "Refreshed all user collections",
        totalUsers: result.totalUsers,
        totalCardsUpdated: result.totalCardsUpdated,
        timestamp: new Date().toISOString(),
      });
    } else {
      return NextResponse.json(
        { error: "Must specify userId or all=true" },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error("Error refreshing collection values:", error);
    return NextResponse.json(
      { error: "Failed to refresh collection values", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

// GET endpoint to check last refresh time
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");

  if (!userId) {
    return NextResponse.json(
      { error: "userId required" },
      { status: 400 }
    );
  }

  try {
    const { getLastRefreshTime } = await import("@/lib/cards");
    const lastRefresh = await getLastRefreshTime(userId);

    return NextResponse.json({
      userId,
      lastRefresh: lastRefresh ? lastRefresh.toISOString() : null,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error checking refresh time:", error);
    return NextResponse.json(
      { error: "Failed to check refresh time" },
      { status: 500 }
    );
  }
}
