"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";

interface FavoriteTeam {
  id: string;
  sport: string;
  team_name: string;
}

const SPORTS = [
  { name: "Football", icon: "⚽" },
  { name: "Cricket", icon: "🏏" },
  { name: "F1", icon: "🏎️" },
  { name: "Badminton", icon: "🏸" },
  { name: "Tennis", icon: "🎾" },
  { name: "Kabaddi", icon: "🤼" },
];

export default function TeamsPage() {
  const { user, loading: authLoading } = useAuth();
  const [teams, setTeams] = useState<FavoriteTeam[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<"view" | "add">("view");

  useEffect(() => {
    if (user) {
      loadTeams();
    }
  }, [user]);

  async function loadTeams() {
    setLoading(true);
    const { data, error } = await supabase
      .from("favorite_teams")
      .select("*")
      .eq("user_id", user?.id);

    if (error) {
      console.error("Error loading favorite teams:", error.message);
      // Fallback if table doesn't exist yet
      setTeams([]);
      setMode("add");
    } else if (data && data.length > 0) {
      setTeams(data);
      setMode("view");
    } else {
      setTeams([]);
      setMode("add");
    }
    setLoading(false);
  }

  if (authLoading || loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#E4DDD3]">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-[#00A19B] border-t-transparent"></div>
          <p className="font-bold text-[#17211F]/60">Loading teams...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#E4DDD3] p-8">
      <header className="flex justify-between items-center mb-10 max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-[#17211F]">Favorite Teams</h1>
        <div className="flex items-center gap-4">
          {mode === "view" && (
            <button
              onClick={() => setMode("add")}
              className="bg-[#00A19B] text-white px-6 py-2 rounded-full font-bold shadow-[0_8px_20px_rgba(0,161,155,0.28)] hover:-translate-y-0.5 transition"
            >
              Add Teams
            </button>
          )}
          {mode === "add" && teams.length > 0 && (
            <button
              onClick={() => setMode("view")}
              className="bg-white text-[#17211F] px-6 py-2 rounded-full font-bold shadow-sm hover:-translate-y-0.5 transition"
            >
              Cancel
            </button>
          )}
          <Link href="/" className="text-[#17211F]/60 font-bold hover:text-[#00A19B] transition">
            Back to Calendar
          </Link>
        </div>
      </header>

      <main className="max-w-6xl mx-auto">
        {mode === "view" ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
            {teams.map((team) => (
              <div
                key={team.id}
                className="bg-white/70 backdrop-blur-md border border-[#17211F]/10 rounded-2xl p-6 shadow-sm flex flex-col justify-center items-center h-40 text-center hover:shadow-lg transition cursor-pointer"
              >
                <div className="text-4xl mb-3">
                  {SPORTS.find((s) => s.name.toLowerCase() === team.sport.toLowerCase())?.icon || "🏆"}
                </div>
                <h2 className="text-xl font-bold text-[#17211F]">{team.team_name}</h2>
                <p className="text-sm font-semibold text-[#17211F]/50 mt-1 uppercase tracking-wider">{team.sport}</p>
              </div>
            ))}
          </div>
        ) : (
          <div>
            <h2 className="text-2xl font-bold text-[#17211F] mb-6">Select a Sport</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6">
              {SPORTS.map((sport) => (
                <div
                  key={sport.name}
                  onClick={() => {
                    // Logic to add a team can be implemented later
                    alert(`Selected ${sport.name}. Next step: Choose team.`);
                  }}
                  className="bg-white/70 backdrop-blur-md border border-[#17211F]/10 rounded-2xl p-8 shadow-sm flex flex-col justify-center items-center h-48 hover:shadow-lg hover:-translate-y-1 hover:border-[#00A19B]/30 transition cursor-pointer group"
                >
                  <div className="text-6xl mb-4 group-hover:scale-110 transition-transform">
                    {sport.icon}
                  </div>
                  <h3 className="text-lg font-bold text-[#17211F]">{sport.name}</h3>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
