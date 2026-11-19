"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { useEffect, useState } from "react";

export interface PinnedMatch {
  id: string;
  title: string;
  sport?: "football" | "cricket" | "f1" | "kabaddi" | "other" | string;
  entityName?: string;
  date?: string;
  time?: string;
  venue?: string;
  timestamp?: number;
  status?: string; // "pre" | "in" | "post" | "LIVE" | "FT" | "Scheduled"
  statusDetail?: string; // e.g. "68'", "HT", "Scheduled", "Final"
  homeTeam?: { name: string; score?: string | number };
  awayTeam?: { name: string; score?: string | number };
  summaryScore?: string; // e.g. "2 - 1"
  isLive?: boolean;
  provider?: string;
  lastUpdated?: number;
}

interface LiveScoreState {
  pinnedMatches: PinnedMatch[];
  isExpanded: boolean;
  setIsExpanded: (expanded: boolean) => void;
  pinMatch: (match: PinnedMatch) => void;
  unpinMatch: (id: string) => void;
  isPinned: (id: string, title?: string) => boolean;
  updateMatch: (id: string, updates: Partial<PinnedMatch>) => void;
}

export const useLiveScoreStore = create<LiveScoreState>()(
  persist(
    (set, get) => ({
      pinnedMatches: [],
      isExpanded: false,
      setIsExpanded: (isExpanded) => set({ isExpanded }),
      pinMatch: (match) => {
        const current = get().pinnedMatches;
        // Avoid duplicate pins
        if (!current.some((m) => m.id === match.id || m.title === match.title)) {
          // Keep up to 3 pinned matches
          const updated = [
            {
              ...match,
              lastUpdated: Date.now(),
            },
            ...current,
          ].slice(0, 3);
          set({ pinnedMatches: updated, isExpanded: false });
        }
      },
      unpinMatch: (id) => {
        set((state) => ({
          pinnedMatches: state.pinnedMatches.filter((m) => m.id !== id && m.title !== id),
        }));
      },
      isPinned: (id, title) => {
        return get().pinnedMatches.some(
          (m) => m.id === id || (title && m.title === title)
        );
      },
      updateMatch: (id, updates) => {
        set((state) => ({
          pinnedMatches: state.pinnedMatches.map((m) =>
            m.id === id || m.title === id
              ? { ...m, ...updates, lastUpdated: Date.now() }
              : m
          ),
        }));
      },
    }),
    {
      name: "pinned_sports_scores",
    }
  )
);

/**
 * Hook that guards against Next.js SSR hydration mismatches
 */
export function usePinnedMatches() {
  const [hasHydrated, setHasHydrated] = useState(false);
  const store = useLiveScoreStore();

  useEffect(() => {
    setHasHydrated(true);
  }, []);

  return {
    ...store,
    hasHydrated,
    pinnedMatches: hasHydrated ? store.pinnedMatches : [],
  };
}
