import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";

async function getAuthenticatedUserId(request: NextRequest) {
  const authorization = request.headers.get("authorization") || "";
  const token = authorization.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : "";

  if (!token) {
    throw new Error("Missing authorization token");
  }

  const decodedToken = await adminAuth.verifyIdToken(token);
  return decodedToken.uid;
}

export async function GET(request: NextRequest) {
  const requestedOtherUserId = request.nextUrl.searchParams.get("otherUserId")?.trim() || "";

  try {
    const currentUserId = await getAuthenticatedUserId(request);
    const otherUserId = requestedOtherUserId;

    if (!otherUserId) {
      return NextResponse.json({ error: "otherUserId is required" }, { status: 400 });
    }

    if (otherUserId === currentUserId) {
      return NextResponse.json({ canMessage: false, reason: "You cannot message yourself." });
    }

    const otherUserDoc = await adminDb.collection("users").doc(otherUserId).get();
    if (!otherUserDoc.exists) {
      return NextResponse.json(
        {
          canMessage: false,
          blockedByCurrentUser: false,
          blockedByOtherUser: false,
          reason: "That user could not be found.",
        },
        { status: 404 }
      );
    }

    const otherUserData = otherUserDoc.data() || {};
    const displayName =
      otherUserData.displayName ||
      [otherUserData.firstName, otherUserData.lastName].filter(Boolean).join(" ") ||
      otherUserData.email?.split("@")[0] ||
      "User";

    const [blockedByCurrentUser, blockedByOtherUser] = await Promise.all([
      adminDb.collection("users").doc(currentUserId).collection("blockedUsers").doc(otherUserId).get(),
      adminDb.collection("users").doc(otherUserId).collection("blockedUsers").doc(currentUserId).get(),
    ]);

    if (blockedByCurrentUser.exists) {
      return NextResponse.json({
        canMessage: false,
        blockedByCurrentUser: true,
        blockedByOtherUser: false,
        reason: "You have blocked this user. Unblock them to send messages.",
        recipient: {
          uid: otherUserId,
          displayName,
          email: otherUserData.email || "",
        },
      });
    }

    if (blockedByOtherUser.exists) {
      return NextResponse.json({
        canMessage: false,
        blockedByCurrentUser: false,
        blockedByOtherUser: true,
        reason: "This user has blocked you.",
        recipient: {
          uid: otherUserId,
          displayName,
          email: otherUserData.email || "",
        },
      });
    }

    return NextResponse.json({
      canMessage: true,
      blockedByCurrentUser: false,
      blockedByOtherUser: false,
      recipient: {
        uid: otherUserId,
        displayName,
        email: otherUserData.email || "",
      },
    });
  } catch (error) {
    console.error("Error checking message eligibility:", error);

    if (requestedOtherUserId) {
      return NextResponse.json({
        canMessage: true,
        blockedByCurrentUser: false,
        blockedByOtherUser: false,
        reason: "",
        verificationSkipped: true,
        recipient: {
          uid: requestedOtherUserId,
          displayName: requestedOtherUserId,
          email: "",
        },
      });
    }

    return NextResponse.json(
      {
        canMessage: false,
        blockedByCurrentUser: false,
        blockedByOtherUser: false,
        reason: "Unable to verify messaging permissions.",
      },
      { status: 500 }
    );
  }
}
