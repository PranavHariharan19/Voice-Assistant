"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { usePinnedMatches, PinnedMatch } from "@/lib/live-score-store";

export default function LiveScoreWidget() {
  const { pinnedMatches, unpinMatch, updateMatch, isExpanded, setIsExpanded, hasHydrated } =
    usePinnedMatches();
  const [activeTab, setActiveTab] = useState(0);

  // Auto-poll live score for active pinned match
  const activeMatch = pinnedMatches[activeTab] || pinnedMatches[0];

  const refreshLiveScore = useCallback(
    async (match: PinnedMatch) => {
      if (!match?.id) return;
      try {
        const res = await fetch(
          `/api/sports/live?matchId=${encodeURIComponent(match.id)}&sport=${encodeURIComponent(
            match.sport || "football"
          )}`
        );
        if (res.ok) {
          const data = await res.json();
          if (data && !data.error) {
            updateMatch(match.id, {
              isLive: !!data.isLive,
              status: data.status || match.status,
              statusDetail: data.statusDetail || match.statusDetail,
              summaryScore: data.summaryScore || match.summaryScore,
              homeTeam: data.homeTeam || match.homeTeam,
              awayTeam: data.awayTeam || match.awayTeam,
            });
          }
        }
      } catch (err) {
        console.error("Failed to refresh live score:", err);
      }
    },
    [updateMatch]
  );

  useEffect(() => {
    if (!activeMatch) return;

    // Refresh immediately on mount/switch
    refreshLiveScore(activeMatch);

    // Poll every 35s if live, or every 90s if scheduled/pre-match
    const intervalMs = activeMatch.isLive ? 35000 : 90000;
    const interval = setInterval(() => {
      refreshLiveScore(activeMatch);
    }, intervalMs);

    return () => clearInterval(interval);
  }, [activeMatch?.id, activeMatch?.isLive, refreshLiveScore]);

  // Adjust active tab if pinned match was removed
  useEffect(() => {
    if (activeTab >= pinnedMatches.length && pinnedMatches.length > 0) {
      setActiveTab(pinnedMatches.length - 1);
    }
  }, [pinnedMatches.length, activeTab]);

  if (!hasHydrated || pinnedMatches.length === 0 || !activeMatch) {
    return null;
  }

  const isLive = !!activeMatch.isLive;
  const scoreDisplay =
    activeMatch.summaryScore ||
    (activeMatch.homeTeam?.score !== undefined && activeMatch.awayTeam?.score !== undefined
      ? `${activeMatch.homeTeam.score} - ${activeMatch.awayTeam.score}`
      : null);

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end pointer-events-auto select-none font-sans">
      {/* Expanded Live Score Card */}
      {isExpanded ? (
        <div className="w-[330px] sm:w-[370px] bg-[#17211f]/95 backdrop-blur-xl border border-white/15 rounded-3xl p-5 shadow-2xl shadow-black/40 text-white animate-in slide-in-from-bottom-5 duration-200">
          {/* Header */}
          <div className="flex items-center justify-between gap-2 mb-3 pb-3 border-b border-white/10">
            <div className="flex items-center gap-2">
              {isLive ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-red-500/20 text-red-400 text-[11px] font-bold tracking-wide uppercase">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                  </span>
                  LIVE
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#00A19B]/20 text-[#00A19B] text-[11px] font-bold tracking-wide uppercase">
                  📌 PINNED
                </span>
              )}
              {activeMatch.statusDetail && (
                <span className="text-xs text-white/60 font-medium">{activeMatch.statusDetail}</span>
              )}
            </div>

            <div className="flex items-center gap-1">
              {/* Collapse to Pill Button */}
              <button
                type="button"
                onClick={() => setIsExpanded(false)}
                className="h-7 w-7 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white/70 hover:text-white transition-colors cursor-pointer"
                title="Minimize ticker"
                aria-label="Minimize ticker"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 16 16">
                  <path fillRule="evenodd" d="M1.646 4.646a.5.5 0 0 1 .708 0L8 10.293l5.646-5.647a.5.5 0 0 1 .708.708l-6 6a.5.5 0 0 1-.708 0l-6-6a.5.5 0 0 1 0-.708z"/>
                </svg>
              </button>
              {/* Unpin Button */}
              <button
                type="button"
                onClick={() => unpinMatch(activeMatch.id)}
                className="h-7 w-7 flex items-center justify-center rounded-full bg-white/10 hover:bg-red-500/30 text-white/70 hover:text-red-400 transition-colors cursor-pointer"
                title="Unpin match"
                aria-label="Unpin match"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 16 16">
                  <path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z"/>
                </svg>
              </button>
            </div>
          </div>

          {/* Multiple Matches Tabs */}
          {pinnedMatches.length > 1 && (
            <div className="flex items-center gap-1.5 mb-3 overflow-x-auto pb-1">
              {pinnedMatches.map((m, idx) => (
                <button
                  key={m.id || idx}
                  onClick={() => setActiveTab(idx)}
                  className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg transition-all truncate max-w-[130px] cursor-pointer ${
                    activeTab === idx
                      ? "bg-[#00A19B] text-white"
                      : "bg-white/10 text-white/60 hover:text-white"
                  }`}
                >
                  {m.title.split(" vs ")[0] || `Match ${idx + 1}`}
                </button>
              ))}
            </div>
          )}

          {/* Match Score Display */}
          <div className="flex flex-col gap-2 my-2">
            <h4 className="text-sm font-semibold text-white/90 leading-snug line-clamp-2">
              {activeMatch.title}
            </h4>

            {scoreDisplay ? (
              <div className="flex items-center justify-center gap-4 py-3 bg-white/5 rounded-2xl border border-white/5 my-1">
                <div className="text-center flex-1">
                  <p className="text-xs text-white/60 truncate font-medium">
                    {activeMatch.homeTeam?.name || "Home"}
                  </p>
                  <p className="text-2xl font-black text-white tracking-tight mt-0.5">
                    {activeMatch.homeTeam?.score ?? "-"}
                  </p>
                </div>
                <div className="text-sm font-bold text-white/30">VS</div>
                <div className="text-center flex-1">
                  <p className="text-xs text-white/60 truncate font-medium">
                    {activeMatch.awayTeam?.name || "Away"}
                  </p>
                  <p className="text-2xl font-black text-white tracking-tight mt-0.5">
                    {activeMatch.awayTeam?.score ?? "-"}
                  </p>
                </div>
              </div>
            ) : (
              <div className="py-2.5 px-3 bg-white/5 rounded-xl border border-white/5 text-xs text-white/70">
                <div className="flex items-center gap-2">
                  <span className="text-[#00A19B] font-semibold">📅 {activeMatch.date}</span>
                  <span>at {activeMatch.time}</span>
                </div>
              </div>
            )}

            {activeMatch.venue && (
              <p className="text-[11px] text-white/40 truncate flex items-center gap-1.5 mt-1">
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="currentColor" viewBox="0 0 16 16">
                  <path d="M8 16s6-5.686 6-10A6 6 0 0 0 2 6c0 4.314 6 10 6 10m0-7a3 3 0 1 1 0-6 3 3 0 0 1 0 6"/>
                </svg>
                {activeMatch.venue}
              </p>
            )}
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-between gap-2 mt-4 pt-3 border-t border-white/10 text-xs">
            <Link
              href="/sports"
              className="text-[#00A19B] hover:text-[#00B4AE] font-semibold flex items-center gap-1 transition-colors"
            >
              Open Sports <span>&rarr;</span>
            </Link>
            <button
              type="button"
              onClick={() => refreshLiveScore(activeMatch)}
              className="text-white/40 hover:text-white transition-colors cursor-pointer text-[11px]"
              title="Click to refresh score"
            >
              ↻ Refresh
            </button>
          </div>
        </div>
      ) : (
        /* Collapsed Compact Floating Pill */
        <div className="flex items-center gap-2 bg-[#17211f]/95 hover:bg-[#17211f] backdrop-blur-xl border border-white/20 rounded-full pl-3 pr-2 py-1.5 shadow-2xl shadow-black/50 text-white transition-all hover:scale-[1.02] cursor-pointer">
          <div
            onClick={() => setIsExpanded(true)}
            className="flex items-center gap-2.5 max-w-[240px] sm:max-w-[300px]"
          >
            {isLive ? (
              <span className="relative flex h-2.5 w-2.5 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
              </span>
            ) : (
              <span className="text-xs">📌</span>
            )}

            <div className="flex items-center gap-2 truncate">
              {scoreDisplay ? (
                <span className="text-xs font-bold text-white tracking-wide shrink-0">
                  {scoreDisplay}
                </span>
              ) : null}
              <span className="text-xs font-medium text-white/80 truncate">
                {activeMatch.title}
              </span>
            </div>

            {activeMatch.statusDetail && (
              <span className="text-[10px] font-bold text-[#00A19B] bg-[#00A19B]/20 px-1.5 py-0.5 rounded shrink-0">
                {activeMatch.statusDetail}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1 border-l border-white/15 pl-1.5">
            <button
              type="button"
              onClick={() => setIsExpanded(true)}
              className="h-6 w-6 flex items-center justify-center rounded-full hover:bg-white/10 text-white/60 hover:text-white transition-colors"
              title="Expand score"
              aria-label="Expand score"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="currentColor" viewBox="0 0 16 16">
                <path fillRule="evenodd" d="M7.646 4.646a.5.5 0 0 1 .708 0l6 6a.5.5 0 0 1-.708.708L8 5.707l-5.646 5.647a.5.5 0 0 1-.708-.708l6-6z"/>
              </svg>
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                unpinMatch(activeMatch.id);
              }}
              className="h-6 w-6 flex items-center justify-center rounded-full hover:bg-red-500/20 text-white/60 hover:text-red-400 transition-colors"
              title="Unpin match"
              aria-label="Unpin match"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="currentColor" viewBox="0 0 16 16">
                <path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z"/>
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
