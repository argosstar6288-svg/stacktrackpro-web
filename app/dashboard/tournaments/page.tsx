"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useCurrentUser } from "@/lib/useCurrentUser";
import { formatCredits } from "@/lib/credits";
import {
  listTournaments,
  joinTournament,
  getUserTournamentScore,
} from "@/lib/tournaments";
import type { Tournament } from "@/lib/tournament-types";

const parseTimestamp = (value: any) => {
  if (!value) {
    return "TBD";
  }
  if (typeof value.toDate === "function") {
    return value.toDate().toLocaleString();
  }
  if (typeof value.toMillis === "function") {
    return new Date(value.toMillis()).toLocaleString();
  }
  if (value instanceof Date) {
    return value.toLocaleString();
  }
  const parsed = Date.parse(String(value));
  return Number.isNaN(parsed) ? String(value) : new Date(parsed).toLocaleString();
};

const statusLabel = (status: Tournament["status"]) => {
  switch (status) {
    case "draft":
      return "Draft";
    case "registration_open":
      return "Open for Registration";
    case "active":
      return "Live";
    case "completed":
      return "Completed";
    case "cancelled":
      return "Cancelled";
    default:
      return status;
  }
};

const tournamentTypeLabel = (type: Tournament["type"]) => {
  switch (type) {
    case "value_sprint":
      return "Value Sprint";
    case "rarity_hunt":
      return "Rarity Hunt";
    case "bracket":
      return "Bracket";
    default:
      return "Tournament";
  }
};

export default function TournamentListPage() {
  const { user, loading: authLoading } = useCurrentUser();
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [userBalance, setUserBalance] = useState(0);
  const [joinedIds, setJoinedIds] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [joinStatus, setJoinStatus] = useState<Record<string, string>>({});

  useEffect(() => {
    const loadTournaments = async () => {
      setLoading(true);
      setError(null);

      try {
        const tournaments = await listTournaments({
          status: ["registration_open", "active"],
          limit: 20,
        });

        setTournaments(tournaments);

        if (user?.uid) {
          const userDoc = await getDoc(doc(db, "users", user.uid));
          const profile = userDoc.data() as any;
          setUserBalance(Number(profile?.creditBalance || 0));

          const scoreChecks = await Promise.all(
            tournaments.map(async (tournament) => {
              const score = await getUserTournamentScore(tournament.id, user.uid);
              return [tournament.id, Boolean(score)] as const;
            })
          );

          setJoinedIds(Object.fromEntries(scoreChecks));
        }
      } catch (err) {
        console.error("Error loading tournaments:", err);
        setError("Unable to load tournaments right now. Please refresh.");
      } finally {
        setLoading(false);
      }
    };

    if (!authLoading) {
      loadTournaments();
    }
  }, [user?.uid, authLoading]);

  const handleJoin = async (tournamentId: string) => {
    if (!user?.uid) {
      setError("Please sign in to join a tournament.");
      return;
    }

    setJoinStatus((current) => ({
      ...current,
      [tournamentId]: "Joining...",
    }));

    try {
      const response = await joinTournament(
        {
          tournamentId,
          userId: user.uid,
          displayName: user.displayName || user.email || "Player",
          email: user.email || "",
        },
        userBalance
      );

      if (!response.success) {
        setJoinStatus((current) => ({
          ...current,
          [tournamentId]: response.error || "Unable to join tournament.",
        }));
        return;
      }

      setJoinedIds((current) => ({
        ...current,
        [tournamentId]: true,
      }));
      setUserBalance((balance) => balance - (tournaments.find((t) => t.id === tournamentId)?.entryFeeCredits || 0));
      setJoinStatus((current) => ({
        ...current,
        [tournamentId]: response.message || "Joined!",
      }));
    } catch (err) {
      console.error("Join error:", err);
      setJoinStatus((current) => ({
        ...current,
        [tournamentId]: "Failed to join, please try again.",
      }));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.24em] text-sky-300">Tournaments</p>
          <h1 className="text-3xl font-bold tracking-tight">Compete in Score-Based Events</h1>
          <p className="mt-3 max-w-2xl text-sm text-slate-400 sm:text-base">
            Browse active tournaments, join the next Value Sprint, and climb the leaderboard for credits.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/15"
          >
            Back to dashboard
          </Link>
          <div className="rounded-full border border-slate-700 bg-slate-950/80 px-4 py-2 text-sm text-slate-200">
            Balance: {formatCredits(userBalance)}
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-3xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-100">
          {error}
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="rounded-3xl border border-slate-800/80 bg-slate-950/80 p-5 shadow-xl">
          <h2 className="text-lg font-semibold text-white">Active events</h2>
          <p className="mt-2 text-sm text-slate-400">Open tournaments are listed below. Watching tournaments and practicing with NPC rivals are free — only paid entry is required for competition.</p>
        </div>
        <div className="rounded-3xl border border-slate-800/80 bg-slate-950/80 p-5 shadow-xl">
          <h3 className="text-base font-semibold text-white">Entry fee</h3>
          <p className="mt-2 text-sm text-slate-400">Tournament entry fees are charged immediately when you join.</p>
        </div>
        <div className="rounded-3xl border border-slate-800/80 bg-slate-950/80 p-5 shadow-xl">
          <h3 className="text-base font-semibold text-white">Leaderboard rewards</h3>
          <p className="mt-2 text-sm text-slate-400">Prizes are distributed to top finishers after each tournament completes.</p>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {loading ? (
          <div className="rounded-3xl border border-slate-800/80 bg-slate-950/80 p-8 text-center text-slate-400">Loading tournaments…</div>
        ) : tournaments.length === 0 ? (
          <div className="rounded-3xl border border-slate-800/80 bg-slate-950/80 p-8 text-center text-slate-400">No active tournaments available right now.</div>
        ) : (
          tournaments.map((tournament) => {
            const isJoined = Boolean(joinedIds[tournament.id]);
            const canJoin = tournament.status === "registration_open" && !isJoined;
            const statusText = statusLabel(tournament.status);

            return (
              <div key={tournament.id} className="overflow-hidden rounded-[2rem] border border-white/10 bg-slate-950/80 p-6 shadow-xl">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.28em] text-sky-300">{tournamentTypeLabel(tournament.type)}</p>
                    <h2 className="mt-3 text-2xl font-semibold text-white">{tournament.name}</h2>
                    <p className="mt-3 text-sm leading-6 text-slate-400">{tournament.description || "No description available."}</p>
                  </div>
                  <span className="rounded-full border border-slate-700/90 bg-slate-900/90 px-3 py-1 text-xs uppercase tracking-[0.24em] text-slate-300">
                    {statusText}
                  </span>
                </div>

                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-3xl bg-slate-900/90 p-4 text-sm text-slate-300">
                    <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Prize pool</p>
                    <p className="mt-2 text-lg font-semibold text-white">{formatCredits(tournament.prizePoolCredits)}</p>
                  </div>
                  <div className="rounded-3xl bg-slate-900/90 p-4 text-sm text-slate-300">
                    <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Entry fee</p>
                    <p className="mt-2 text-lg font-semibold text-white">{formatCredits(tournament.entryFeeCredits)}</p>
                  </div>
                  <div className="rounded-3xl bg-slate-900/90 p-4 text-sm text-slate-300">
                    <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Registrations</p>
                    <p className="mt-2 text-lg font-semibold text-white">{tournament.currentEntryCount || 0}/{tournament.maxEntries}</p>
                  </div>
                  <div className="rounded-3xl bg-slate-900/90 p-4 text-sm text-slate-300">
                    <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Schedule</p>
                    <p className="mt-2 text-sm text-white">{parseTimestamp(tournament.registrationOpensAt)} – {parseTimestamp(tournament.registrationDeadline)}</p>
                  </div>
                </div>

                <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-2 text-sm text-slate-300">
                    <p>{isJoined ? "You have joined this tournament." : "Join early to secure your slot."}</p>
                    {joinStatus[tournament.id] && <p className="text-xs text-slate-400">{joinStatus[tournament.id]}</p>}
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <Link
                      href={`/dashboard/tournaments/${tournament.id}`}
                      className="inline-flex items-center justify-center rounded-full border border-slate-700/80 bg-slate-950/90 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:bg-slate-800"
                    >
                      View leaderboard
                    </Link>
                    <button
                      type="button"
                      disabled={!canJoin}
                      onClick={() => handleJoin(tournament.id)}
                      className={`inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-semibold transition ${
                        canJoin
                          ? "bg-sky-500 text-slate-950 hover:bg-sky-400"
                          : "cursor-not-allowed bg-slate-800 text-slate-500"
                      }`}
                    >
                      {isJoined ? "Joined" : tournament.status === "registration_open" ? "Join now" : "Closed"}
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
