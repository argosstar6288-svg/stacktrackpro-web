import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";

type UserSummary = {
  uid: string;
  displayName: string;
  email: string;
  firstName?: string;
  lastName?: string;
};

function mapUserSummary(userId: string, data: FirebaseFirestore.DocumentData): UserSummary {
  const displayName =
    data.displayName ||
    [data.firstName, data.lastName].filter(Boolean).join(" ") ||
    data.email?.split("@")[0] ||
    "Anonymous";

  return {
    uid: userId,
    displayName,
    email: data.email || "",
    firstName: data.firstName || "",
    lastName: data.lastName || "",
  };
}

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

async function getBlockedUserIds(userId: string) {
  const snapshot = await adminDb.collection("users").doc(userId).collection("blockedUsers").get();
  return new Set(snapshot.docs.map((doc) => doc.id));
}

async function filterBlockedUsers(currentUserId: string, users: UserSummary[]) {
  if (users.length === 0) {
    return [];
  }

  const blockedByCurrentUser = await getBlockedUserIds(currentUserId);
  const notBlockedByCurrentUser = users.filter(
    (candidate) => candidate.uid !== currentUserId && !blockedByCurrentUser.has(candidate.uid)
  );

  const blockedCurrentUserChecks = await Promise.all(
    notBlockedByCurrentUser.map(async (candidate) => {
      const blockedDoc = await adminDb
        .collection("users")
        .doc(candidate.uid)
        .collection("blockedUsers")
        .doc(currentUserId)
        .get();

      return {
        candidate,
        isBlocked: blockedDoc.exists,
      };
    })
  );

  return blockedCurrentUserChecks
    .filter((entry) => !entry.isBlocked)
    .map((entry) => entry.candidate);
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const searchTerm = searchParams.get("q")?.toLowerCase().trim();
    const currentUserId = searchParams.get("currentUserId");
    const getRecommendations = searchParams.get("recommendations") === "true";
    const requestedUserId = searchParams.get("uid")?.trim();
    const authenticatedUserId = await getAuthenticatedUserId(request);

    if (currentUserId && currentUserId !== authenticatedUserId) {
      return NextResponse.json(
        { error: "Authenticated user mismatch" },
        { status: 403 }
      );
    }

    if (requestedUserId) {
      if (requestedUserId === authenticatedUserId) {
        return NextResponse.json({
          result: {
            uid: authenticatedUserId,
            displayName: "You",
            email: "",
          },
        });
      }

      const userDoc = await adminDb.collection("users").doc(requestedUserId).get();
      if (!userDoc.exists) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }

      const [result] = await filterBlockedUsers(authenticatedUserId, [
        mapUserSummary(userDoc.id, userDoc.data() || {}),
      ]);

      if (!result) {
        return NextResponse.json({ error: "User unavailable" }, { status: 403 });
      }

      return NextResponse.json({ result });
    }

    const usersRef = adminDb.collection("users");

    if (getRecommendations) {
      const recentSnap = await usersRef.orderBy("createdAt", "desc").limit(20).get();
      const recommendations = await filterBlockedUsers(
        authenticatedUserId,
        recentSnap.docs.map((doc) => mapUserSummary(doc.id, doc.data()))
      );

      return NextResponse.json({ results: recommendations.slice(0, 5) });
    }

    if (!searchTerm || searchTerm.length < 2) {
      return NextResponse.json(
        { error: "Search term must be at least 2 characters" },
        { status: 400 }
      );
    }

    const snapshot = await usersRef.limit(100).get();
    const matchingUsers = snapshot.docs
      .map((doc) => mapUserSummary(doc.id, doc.data()))
      .filter((candidate) => {
        const haystack = [
          candidate.displayName,
          candidate.email,
          candidate.firstName,
          candidate.lastName,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return haystack.includes(searchTerm);
      });

    const results = await filterBlockedUsers(authenticatedUserId, matchingUsers);

    return NextResponse.json({ results: results.slice(0, 20) });
  } catch (error) {
    console.error("Error searching users:", error);
    return NextResponse.json(
      { error: "Failed to search users" },
      { status: 500 }
    );
  }
}
