import { NextResponse } from "next/server";
import { processQueuedJobs } from "../../background-price-updater/route";

const CRON_SECRET = process.env.CRON_SECRET || "";

/**
 * Vercel Cron endpoint — called on a schedule to process any
 * remaining queued price-update jobs (e.g. jobs that failed to
 * process inline due to a timeout or server error).
 *
 * Vercel sends: Authorization: Bearer <CRON_SECRET>
 * Configure in vercel.json + set CRON_SECRET env var in Vercel dashboard.
 */
export async function GET(request: Request) {
  // Validate cron secret
  const authHeader = request.headers.get("authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";

  if (!CRON_SECRET || token !== CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await processQueuedJobs(5);
    console.log("[Cron] Processed", result.processedJobs, "jobs,", result.totalCardsUpdated, "cards updated");
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("[Cron] process-price-updates error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
