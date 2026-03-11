import { NextRequest, NextResponse } from "next/server";
import {
  collection,
  query,
  where,
  getDocs,
  limit,
  orderBy,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const searchTerm = searchParams.get("q")?.toLowerCase().trim();
    const currentUserId = searchParams.get("currentUserId");
    const getRecommendations = searchParams.get("recommendations") === "true";

    if (!currentUserId) {
      return NextResponse.json(
        { error: "currentUserId is required" },
        { status: 400 }
      );
    }

    const usersRef = collection(db, "users");

    if (getRecommendations) {
      // Get recommended users (active users you haven't chatted with)
      const recentActiveQuery = query(
        usersRef,
        orderBy("createdAt", "desc"),
        limit(10)
      );

      const recentSnap = await getDocs(recentActiveQuery);

      const recommendations = recentSnap.docs
        .map((doc) => ({
          uid: doc.id,
          displayName: doc.data().displayName,
          email: doc.data().email,
          firstName: doc.data().firstName,
          lastName: doc.data().lastName,
        }))
        .filter((user) => user.uid !== currentUserId)
        .slice(0, 5);

      return NextResponse.json({ results: recommendations });
    }

    if (!searchTerm || searchTerm.length < 2) {
      return NextResponse.json(
        { error: "Search term must be at least 2 characters" },
        { status: 400 }
      );
    }

    // Search by display name (case-insensitive prefix match)
    const displayNameQuery = query(
      usersRef,
      where("displayName", ">=", searchTerm.charAt(0).toUpperCase() + searchTerm.slice(1)),
      where("displayName", "<=", searchTerm + "\uf8ff"),
      limit(20)
    );

    const [displayNameSnap] = await Promise.all([getDocs(displayNameQuery)]);

    const results = displayNameSnap.docs
      .map((doc) => ({
        uid: doc.id,
        displayName: doc.data().displayName,
        email: doc.data().email,
        firstName: doc.data().firstName,
        lastName: doc.data().lastName,
      }))
      // Filter out current user
      .filter((user) => user.uid !== currentUserId)
      // Remove duplicates
      .reduce((acc: Array<{ uid: string; displayName: string; email: string; firstName: string; lastName: string }>, user) => {
        if (!acc.find((u) => u.uid === user.uid)) {
          acc.push(user);
        }
        return acc;
      }, []);

    return NextResponse.json({ results });
  } catch (error) {
    console.error("Error searching users:", error);
    return NextResponse.json(
      { error: "Failed to search users" },
      { status: 500 }
    );
  }
}
