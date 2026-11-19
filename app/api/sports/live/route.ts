import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const matchId = searchParams.get("matchId");
  const sport = (searchParams.get("sport") || "football").toLowerCase();

  if (!matchId) {
    return NextResponse.json({ error: "Missing matchId" }, { status: 400 });
  }

  try {
    // 1. Football / Soccer Live Updates (via ESPN)
    if (sport === "football" || sport === "soccer") {
      const espnRes = await fetch(
        `https://site.api.espn.com/apis/site/v2/sports/soccer/all/summary?event=${matchId}`,
        {
          headers: { "Content-Type": "application/json" },
          next: { revalidate: 30 }, // 30s cache for fast live updates
        }
      );

      if (espnRes.ok) {
        const data = await espnRes.json();
        const competition = data.header?.competitions?.[0];
        const statusObj = competition?.status;
        const state = statusObj?.type?.state; // "pre" | "in" | "post"
        const isLive = state === "in";
        const shortDetail =
          statusObj?.type?.shortDetail ||
          statusObj?.type?.detail ||
          (isLive ? "LIVE" : state === "post" ? "Final" : "Scheduled");

        const competitors = competition?.competitors || [];
        const homeComp = competitors.find((c: any) => c.homeAway === "home") || competitors[0];
        const awayComp = competitors.find((c: any) => c.homeAway === "away") || competitors[1];

        const homeScore = homeComp?.score !== undefined ? String(homeComp.score) : undefined;
        const awayScore = awayComp?.score !== undefined ? String(awayComp.score) : undefined;

        let summaryScore: string | undefined = undefined;
        if (homeScore !== undefined && awayScore !== undefined) {
          summaryScore = `${homeScore} - ${awayScore}`;
        }

        return NextResponse.json(
          {
            matchId,
            isLive,
            status: state,
            statusDetail: shortDetail,
            homeTeam: homeComp ? { name: homeComp.team?.displayName || "Home", score: homeScore } : undefined,
            awayTeam: awayComp ? { name: awayComp.team?.displayName || "Away", score: awayScore } : undefined,
            summaryScore,
            lastChecked: Date.now(),
          },
          {
            headers: {
              "Cache-Control": "public, max-age=30, s-maxage=30, stale-while-revalidate=60",
            },
          }
        );
      }
    }

    // 2. Cricket Live Updates (via Cricbuzz RapidAPI if available)
    if (sport === "cricket") {
      const rapidApiKey = process.env.RAPIDAPI_KEY;
      if (rapidApiKey) {
        try {
          const cricRes = await fetch("https://cricbuzz-cricket.p.rapidapi.com/matches/v1/live", {
            headers: {
              "x-rapidapi-host": "cricbuzz-cricket.p.rapidapi.com",
              "x-rapidapi-key": rapidApiKey,
            },
            next: { revalidate: 45 },
          });

          if (cricRes.ok) {
            const cricData = await cricRes.json();
            const typeMatches = cricData.typeMatches || [];
            let matchedGame: any = null;

            for (const t of typeMatches) {
              const seriesMatches = t.seriesMatches || [];
              for (const s of seriesMatches) {
                const wrappers = s.seriesAdWrapper?.matches || [];
                for (const m of wrappers) {
                  const info = m.matchInfo;
                  if (info && String(info.matchId) === String(matchId)) {
                    matchedGame = m;
                    break;
                  }
                }
                if (matchedGame) break;
              }
              if (matchedGame) break;
            }

            if (matchedGame) {
              const info = matchedGame.matchInfo;
              const score = matchedGame.matchScore;
              const isLive = info.state === "In Progress";
              const team1 = info.team1?.teamName || "Team 1";
              const team2 = info.team2?.teamName || "Team 2";

              const team1Score = score?.team1Score?.inngs1
                ? `${score.team1Score.inngs1.runs}/${score.team1Score.inngs1.wickets || 0} (${score.team1Score.inngs1.overs} ov)`
                : undefined;
              const team2Score = score?.team2Score?.inngs1
                ? `${score.team2Score.inngs1.runs}/${score.team2Score.inngs1.wickets || 0} (${score.team2Score.inngs1.overs} ov)`
                : undefined;

              const summaryScore = [team1Score, team2Score].filter(Boolean).join(" vs ") || info.status;

              return NextResponse.json({
                matchId,
                isLive,
                status: info.state,
                statusDetail: info.status || (isLive ? "LIVE" : "Upcoming"),
                homeTeam: { name: team1, score: team1Score },
                awayTeam: { name: team2, score: team2Score },
                summaryScore,
                lastChecked: Date.now(),
              });
            }
          }
        } catch (cErr) {
          console.error("Error fetching live cricket match:", cErr);
        }
      }
    }

    // Default response if match isn't currently ongoing or detailed API is not available
    return NextResponse.json({
      matchId,
      isLive: false,
      status: "scheduled",
      statusDetail: "Scheduled",
      lastChecked: Date.now(),
    });
  } catch (error: any) {
    console.error("Error checking live score:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch live score" },
      { status: 500 }
    );
  }
}
