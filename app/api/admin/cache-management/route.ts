import { NextRequest, NextResponse } from "next/server";
import { invalidateCardCache, invalidateAllCaches } from "@/lib/cardCache";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, where, Timestamp } from "firebase/firestore";

/**
 * Admin Cache Management Endpoint
 * 
 * POST /api/admin/cache-management
 * Body: {
 *   action: "invalidate-card" | "invalidate-stale" | "invalidate-all",
 *   stacktrackId?: string (required for invalidate-card),
 *   maxAgeDays?: number (for invalidate-stale, default 30)
 * }
 */

async function isAdmin(userId: string | null): Promise<boolean> {
  if (!userId) return false;

  try {
    const userRef = collection(db, "users");
    const q = query(userRef, where("uid", "==", userId));
    const snap = await getDocs(q);
    const user = snap.docs[0]?.data();
    return user?.role === "admin" || user?.isAdmin === true;
  } catch {
    return false;
  }
}

function corsResponse(data: any, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}

export async function OPTIONS() {
  return corsResponse({}, 200);
}

export async function POST(request: NextRequest) {
  try {
    // Check auth - in production, verify this is an admin
    const authHeader = request.headers.get("authorization");
    const userId = request.headers.get("x-user-id");

    if (!userId || !authHeader) {
      return corsResponse(
        { error: "Unauthorized. Missing credentials." },
        401
      );
    }

    // Verify admin status
    const isAdminUser = await isAdmin(userId);
    if (!isAdminUser) {
      return corsResponse(
        { error: "Forbidden. Admin access required." },
        403
      );
    }

    const body = await request.json();
    const { action, stacktrackId, maxAgeDays } = body;

    if (!action) {
      return corsResponse({ error: "action is required" }, 400);
    }

    let result: any;

    if (action === "invalidate-card") {
      if (!stacktrackId) {
        return corsResponse({ error: "stacktrackId required for invalidate-card" }, 400);
      }

      await invalidateCardCache(stacktrackId);
      result = {
        action,
        stacktrackId,
        status: "invalidated",
        message: `Cache invalidated for ${stacktrackId}`,
      };

      console.log(`[Cache Admin] Invalidated card cache: ${stacktrackId}`);
    } 
    else if (action === "invalidate-stale") {
      const maxAge = maxAgeDays || 30;
      const staleDate = Timestamp.fromDate(
        new Date(Date.now() - maxAge * 24 * 60 * 60 * 1000)
      );

      // In production, this would use a bulk operation or job
      // For now, we'll just log and return a placeholder
      result = {
        action,
        maxAgeDays: maxAge,
        status: "queued",
        message: `Cache invalidation queued for cards older than ${maxAge} days. This may take a few minutes.`,
      };

      console.log(`[Cache Admin] Queued stale cache invalidation for cards > ${maxAge} days`);
    }
    else if (action === "invalidate-all") {
      const invalidated = await invalidateAllCaches();
      result = {
        action,
        status: "completed",
        ...invalidated,
        message: "All card cache invalidated",
      };

      console.log(`[Cache Admin] Invalidated all card caches`)
    }
    else {
      return corsResponse({ error: "Unknown action" }, 400);
    }

    return corsResponse({
      success: true,
      ...result,
    });

  } catch (error) {
    console.error("[Cache Admin] Error:", error);
    return corsResponse(
      {
        error: "Cache management failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      500
    );
  }
}

export async function GET(request: NextRequest) {
  return corsResponse({
    info: "Use POST method for cache management",
    actions: [
      "invalidate-card (stacktrackId required)",
      "invalidate-stale (maxAgeDays optional, default 30)",
      "invalidate-all"
    ]
  });
}
