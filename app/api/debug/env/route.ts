import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  // Check if user is authenticated (basic security)
  const authHeader = request.headers.get("authorization");
  const isAuthenticated = authHeader === "Bearer debug-key-12345";

  return NextResponse.json({
    openaiKeyFound: !!process.env.OPENAI_API_KEY,
    openaiKeyLength: process.env.OPENAI_API_KEY?.length || 0,
    openaiKeyStartsWith: process.env.OPENAI_API_KEY?.substring(0, 20) || "NOT SET",
    nodeEnv: process.env.NODE_ENV,
    vercelEnv: process.env.VERCEL_ENV,
    allEnvKeys: isAuthenticated
      ? Object.keys(process.env)
          .filter(k => k.includes("OPENAI") || k.includes("API") || k.includes("NEXT"))
          .sort()
      : "Provide Authorization: Bearer debug-key-12345",
  });
}
