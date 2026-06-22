/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const entityId = searchParams.get("entityId");

  if (!entityId) {
    return NextResponse.json({ error: "Missing entityId" }, { status: 400 });
  }

  // Use service role or anon key. Since this is an API route, we can use anon key if RLS allows, 
  // or we can just fetch using the anon key
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  // 1. Fetch entity_sources for the given favorite_entity_id
  const { data: sourceData, error: sourceError } = await supabase
    .from("entity_sources")
    .select("*")
    .eq("favorite_entity_id", entityId)
    .single();

  if (sourceError || !sourceData) {
    return NextResponse.json({ error: "No source mapping found for this entity" }, { status: 404 });
  }

  const { provider, external_id } = sourceData;

  try {
    let schedule: any[] = [];

    if (provider === 'api-football') {
      const apiKey = process.env.API_FOOTBALL_KEY || '';
      // Use season=2024 instead of next=3 because next is not available on free plans
      const res = await fetch(`https://v3.football.api-sports.io/fixtures?team=${external_id}&season=2024`, {
        headers: {
          'x-apisports-key': apiKey
        }
      });
      if (res.ok) {
        const data = await res.json();
        const allFixtures = data.response || [];
        const now = new Date().toISOString();
        let matchesToShow = allFixtures.filter((m: any) => m.fixture.date > now).sort((a: any, b: any) => a.fixture.date.localeCompare(b.fixture.date));
        
        if (matchesToShow.length === 0) {
           // fallback to all past fixtures if no future matches found
           matchesToShow = allFixtures;
        }

        schedule = matchesToShow.map((match: any) => {
          const d = new Date(match.fixture.date);
          return {
            id: match.fixture.id.toString(),
            title: `${match.teams.home.name} vs ${match.teams.away.name}`,
            date: new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', day: '2-digit', month: '2-digit', year: 'numeric' }).format(d),
            time: new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: false }).format(d),
            venue: match.fixture.venue.name
          };
        });
      } else {
        console.error('API-Football error:', res.statusText);
      }
    } else if (provider === 'cricbuzz') {
      const apiKey = process.env.RAPIDAPI_KEY || '';
      const res = await fetch(`https://cricbuzz-cricket.p.rapidapi.com/matches/v1/recent`, {
        headers: {
          'x-rapidapi-host': 'cricbuzz-cricket.p.rapidapi.com',
          'x-rapidapi-key': apiKey
        }
      });
      if (res.ok) {
        const data = await res.json();
        
        const allMatches: any[] = [];
        if (data.typeMatches) {
          for (const tm of data.typeMatches) {
            if (tm.seriesMatches) {
              for (const sm of tm.seriesMatches) {
                if (sm.seriesAdWrapper && sm.seriesAdWrapper.matches) {
                  allMatches.push(...sm.seriesAdWrapper.matches);
                }
              }
            }
          }
        }
        
        schedule = allMatches.map((match: any) => {
          const d = new Date(parseInt(match.matchInfo.startDate));
          return {
            id: match.matchInfo.matchId.toString(),
            title: `${match.matchInfo.team1.teamName} vs ${match.matchInfo.team2.teamName}`,
            date: new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', day: '2-digit', month: '2-digit', year: 'numeric' }).format(d),
            time: new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: false }).format(d),
            venue: match.matchInfo.venueInfo.ground
          };
        });
      } else {
        console.error('Cricbuzz RapidAPI error:', res.statusText);
      }
    } else if (provider === 'pkl') {
      // Mock logic for PKL or use an existing endpoint if known
      const res = await fetch(`https://www.prokabaddi.com/sifeeds/kabaddi/live/json/1_schedule.json`);
      if (res.ok) {
        const data = await res.json();
        schedule = (data.matches || []).filter((m: any) => 
          m.participants[0].id === external_id || m.participants[1].id === external_id
        ).map((match: any) => {
          const dateParts = match.start_date ? match.start_date.split('-') : [];
          const formattedDate = dateParts.length === 3 ? `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}` : match.start_date;
          return {
            id: match.game_id.toString(),
            title: `${match.participants[0].name} vs ${match.participants[1].name}`,
            date: formattedDate,
            time: match.start_time,
            venue: match.venue_name
          };
        });
      } else {
        console.error('PKL API error:', res.statusText);
      }
    } else if (provider === 'ergast') {
      const res = await fetch(`https://api.jolpi.ca/ergast/f1/current.json`);
      if (res.ok) {
        const data = await res.json();
        const allRaces = data?.MRData?.RaceTable?.Races || [];
        const now = new Date().toISOString().split('T')[0]; // compare YYYY-MM-DD
        
        let futureRaces = allRaces.filter((r: any) => r.date >= now);
        if (futureRaces.length === 0) {
          // fallback to all races if season ended
          futureRaces = allRaces;
        }

        schedule = futureRaces.map((race: any) => {
          let dateIST = race.date;
          let timeIST = race.time ? race.time.substring(0, 5) : 'TBA';
          if (race.date && race.time) {
            const d = new Date(`${race.date}T${race.time}`);
            dateIST = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', day: '2-digit', month: '2-digit', year: 'numeric' }).format(d);
            timeIST = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: false }).format(d);
          } else if (race.date) {
            const parts = race.date.split('-');
            if (parts.length === 3) dateIST = `${parts[2]}/${parts[1]}/${parts[0]}`;
          }
          return {
            id: race.round.toString(),
            title: race.raceName,
            date: dateIST,
            time: timeIST,
            venue: race.Circuit.circuitName
          };
        });
      } else {
        console.error('Ergast API error:', res.statusText);
      }
    } else {
      // Default fallback
      schedule = [];
    }

    return NextResponse.json({
      provider,
      external_id,
      schedule
    });

  } catch (e) {
    console.error("Error fetching schedule data:", e);
    return NextResponse.json({ error: "Failed to fetch schedule from data source" }, { status: 500 });
  }
}
