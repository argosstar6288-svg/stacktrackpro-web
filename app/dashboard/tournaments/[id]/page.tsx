"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useCurrentUser } from "@/lib/useCurrentUser";
import { formatCredits } from "@/lib/credits";
import {
  getTournamentById,
  getLeaderboard,
  getUserReward,
  estimateRewardForRank,
  getRewardDistribution,
} from "@/lib/tournaments";
import type { LeaderboardEntry, Tournament, TournamentReward } from "@/lib/tournament-types";

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

export default function TournamentDetailPage() {
  const params = useParams();
  const tournamentId = typeof params?.id === "string" ? params.id : Array.isArray(params?.id) ? params.id[0] : undefined;
  const { user, loading: authLoading } = useCurrentUser();
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [userEntry, setUserEntry] = useState<LeaderboardEntry | null>(null);
  const [reward, setReward] = useState<TournamentReward | null>(null);
  const [claiming, setClaiming] = useState(false);
  const [claimMessage, setClaimMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadDetail = async () => {
      if (!tournamentId) {
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const tournament = await getTournamentById(tournamentId);
        if (!tournament) {
          setError("Tournament not found.");
          setTournament(null);
          setLoading(false);
          return;
        }

        const leaderboardResponse = await getLeaderboard(tournamentId, 10, 0, user?.uid);
        let rewardData: TournamentReward | null = null;
        if (user?.uid) {
          rewardData = await getUserReward(tournamentId, user.uid);
        }

        setTournament(tournament);
        setLeaderboard(leaderboardResponse.entries);
        setUserEntry(leaderboardResponse.userEntry || null);
        setReward(rewardData);
      } catch (err) {
        console.error("Error loading tournament details:", err);
        setError("Unable to load leaderboard. Please refresh.");
      } finally {
        setLoading(false);
      }
    };

    if (!authLoading) {
      loadDetail();
    }
  }, [tournamentId, user?.uid, authLoading]);

  const handleClaimReward = async () => {
    if (!user?.uid || !tournamentId || !reward) {
      setClaimMessage("Unable to claim reward. Please sign in and try again.");
      return;
    }

    setClaiming(true);
    setClaimMessage(null);

    try {
      const response = await fetch(`/api/tournaments/${tournamentId}/claim-reward`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: user.uid,
          rewardId: reward.id,
        }),
      });

      const result = await response.json();
      if (!response.ok || !result.success) {
        setClaimMessage(result.error || "Claim failed. Please try again.");
      } else {
        setClaimMessage(`Claimed ${result.creditsAdded} credits successfully!`);
        setReward((current) =>
          current
            ? {
                ...current,
                claimedAt: {
                  seconds: Math.floor(Date.now() / 1000),
                  nanoseconds: 0,
                } as any,
              }
            : current
        );
      }
    } catch (err) {
      console.error("Claim reward error:", err);
      setClaimMessage("Unable to claim reward at this time.");
    } finally {
      setClaiming(false);
    }
  };

  if (loading) {
    return <div className="rounded-3xl border border-slate-800/80 bg-slate-950/80 p-8 text-center text-slate-400">Loading tournament details…</div>;
  }

  if (error || !tournament) {
    return (
      <div className="rounded-3xl border border-red-500/20 bg-red-500/10 p-8 text-center text-sm text-red-100">
        {error || "Tournament not available."}
        <div className="mt-4">
          <Link href="/dashboard/tournaments" className="inline-flex rounded-full bg-white/10 px-4 py-2 text-sm text-white transition hover:bg-white/15">
            Back to tournaments
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.24em] text-sky-300">Tournament</p>
          <h1 className="text-3xl font-bold tracking-tight text-white">{tournament.name}</h1>
          <p className="mt-3 max-w-2xl text-sm text-slate-400">{tournament.description || "Score cards, earn credits, and compete for leaderboard prizes."}</p>
        </div>
        <Link
          href="/dashboard/tournaments"
          className="inline-flex items-center justify-center rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/15"
        >
          Back to tournaments
        </Link>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-3xl border border-slate-800/80 bg-slate-950/80 p-6 shadow-xl">
          <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Status</p>
          <p className="mt-2 text-lg font-semibold text-white">{statusLabel(tournament.status)}</p>
          <div className="mt-4 space-y-3 text-sm text-slate-400">
            <div>
              <p className="text-slate-500">Type</p>
              <p>{tournament.type.replace("_", " ")}</p>
            </div>
            <div>
              <p className="text-slate-500">Entry fee</p>
              <p>{formatCredits(tournament.entryFeeCredits)}</p>
            </div>
            <div>
              <p className="text-slate-500">Prize pool</p>
              <p>{formatCredits(tournament.prizePoolCredits)}</p>
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-800/80 bg-slate-950/80 p-6 shadow-xl lg:col-span-2">
          <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Schedule</p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="rounded-3xl bg-slate-900/90 p-4 text-sm text-slate-300">
              <p className="text-slate-500">Registration opens</p>
              <p className="mt-2 text-white">{parseTimestamp(tournament.registrationOpensAt)}</p>
            </div>
            <div className="rounded-3xl bg-slate-900/90 p-4 text-sm text-slate-300">
              <p className="text-slate-500">Registration closes</p>
              <p className="mt-2 text-white">{parseTimestamp(tournament.registrationDeadline)}</p>
            </div>
            <div className="rounded-3xl bg-slate-900/90 p-4 text-sm text-slate-300">
              <p className="text-slate-500">Starts</p>
              <p className="mt-2 text-white">{parseTimestamp(tournament.startTime)}</p>
            </div>
            <div className="rounded-3xl bg-slate-900/90 p-4 text-sm text-slate-300">
              <p className="text-slate-500">Ends</p>
              <p className="mt-2 text-white">{parseTimestamp(tournament.endTime)}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-3xl border border-slate-800/80 bg-slate-950/80 p-6 shadow-xl">
          <p className="text-sm text-slate-300">Minimum entries</p>
          <p className="mt-2 text-3xl font-semibold text-white">{tournament.minEntries}</p>
        </div>
        <div className="rounded-3xl border border-slate-800/80 bg-slate-950/80 p-6 shadow-xl">
          <p className="text-sm text-slate-300">Maximum entries</p>
          <p className="mt-2 text-3xl font-semibold text-white">{tournament.maxEntries}</p>
        </div>
        <div className="rounded-3xl border border-slate-800/80 bg-slate-950/80 p-6 shadow-xl">
          <p className="text-sm text-slate-300">Current entries</p>
          <p className="mt-2 text-3xl font-semibold text-white">{tournament.currentEntryCount || 0}</p>
        </div>
      </div>

      {(tournament.status === 'active' || tournament.status === 'registration_open') && userEntry && (
        <div className="rounded-3xl border border-slate-800/80 bg-slate-950/80 p-6 shadow-xl">
          <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Projected reward</p>
          <div className="mt-3 flex flex-col gap-2 text-sm text-slate-300 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-lg font-semibold text-white">
                {formatCredits(estimateRewardForRank(tournament, userEntry.rank))} if you finish at #{userEntry.rank}
              </p>
              <p className="mt-2 text-slate-400">
                Your current rank is #{userEntry.rank}. Final rewards are issued when the tournament ends.
              </p>
            </div>
            <div className="rounded-3xl bg-slate-900/90 px-4 py-3 text-sm text-slate-300">
              <p className="font-semibold text-white">Reward tiers</p>
              <div className="mt-3 space-y-2">
                {getRewardDistribution(tournament).map((tier) => (
                  <div key={tier.label} className="flex items-center justify-between text-slate-400">
                    <span>{tier.label}</span>
                    <span className="text-white">{formatCredits(tier.credits)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      <section className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Leaderboard</p>
            <h2 className="text-2xl font-semibold text-white">Top performers</h2>
          </div>
          <p className="text-sm text-slate-400">Updated live when scoring is active.</p>
        </div>

        <div className="overflow-hidden rounded-[2rem] border border-white/10 bg-slate-950/80 shadow-xl">
          <div className="grid grid-cols-[64px_auto_96px] gap-4 border-b border-white/10 bg-slate-900/90 px-6 py-4 text-sm uppercase tracking-[0.24em] text-slate-500">
            <span>Rank</span>
            <span>Player</span>
            <span className="text-right">Score</span>
          </div>
          {leaderboard.length === 0 ? (
            <div className="p-8 text-center text-slate-400">No leaderboard entries yet.</div>
          ) : (
            leaderboard.map((entry) => (
              <div key={entry.userId} className="grid grid-cols-[64px_auto_96px] gap-4 border-b border-white/5 px-6 py-4 text-sm text-slate-200 last:border-none">
                <span className="text-slate-300">#{entry.rank}</span>
                <div>
                  <p className="font-semibold text-white">{entry.displayName}</p>
                  <p className="text-xs text-slate-500">{entry.badges?.length ? entry.badges.join(", ") : ""}</p>
                </div>
                <span className="text-right font-semibold text-white">{entry.score}</span>
              </div>
            ))
          )}
        </div>
      </section>

      {userEntry && userEntry.rank > 10 && (
        <div className="rounded-3xl border border-slate-800/80 bg-slate-950/80 p-6 text-sm text-slate-300 shadow-xl">
          <p className="text-slate-400">Your current ranking</p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-lg font-semibold text-white">#{userEntry.rank}</p>
              <p className="text-slate-400">{userEntry.displayName}</p>
            </div>
            <p className="text-right text-white">{userEntry.score} points</p>
          </div>
        </div>
      )}

      {tournament.status === "completed" && user?.uid && (
        <div className="rounded-3xl border border-slate-800/80 bg-slate-950/80 p-6 shadow-xl">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.24em] text-slate-500">Tournament reward</p>
              {reward ? (
                <div className="mt-3 space-y-2">
                  <p className="text-lg font-semibold text-white">Rank #{reward.finalRank}</p>
                  <p className="text-slate-400">{reward.creditsWon} credits won</p>
                  {reward.badgesEarned?.length ? (
                    <p className="text-sm text-slate-400">Badges: {reward.badgesEarned.join(", ")}</p>
                  ) : null}
                </div>
              ) : (
                <p className="mt-3 text-slate-400">No reward found for your account yet. If you placed in the top ranks, this will appear once results are finalized.</p>
              )}
            </div>
            {reward && (
              <div className="flex flex-col items-start gap-3 sm:items-end">
                <button
                  disabled={Boolean(reward.claimedAt) || claiming}
                  onClick={handleClaimReward}
                  className={`inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-semibold transition ${
                    reward.claimedAt
                      ? "bg-slate-800 text-slate-500 cursor-not-allowed"
                      : "bg-emerald-500 text-slate-950 hover:bg-emerald-400"
                  }`}
                >
                  {reward.claimedAt ? "Already claimed" : claiming ? "Claiming…" : "Claim reward"}
                </button>
                {reward.claimedAt && (
                  <p className="text-sm text-slate-400">Claimed on {parseTimestamp(reward.claimedAt)}</p>
                )}
              </div>
            )}
          </div>
          {claimMessage && (
            <p className="mt-4 text-sm text-emerald-300">{claimMessage}</p>
          )}
        </div>
      )}
    </div>
  );
}
