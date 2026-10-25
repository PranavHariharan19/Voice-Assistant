/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function formatEspnSoccerMatch(match: any) {
  const d = new Date(match.date);
  const competition = match.competitions?.[0];

  const venueName = competition?.venue?.fullName;
  const venueCity = competition?.venue?.address?.city;
  const venue = venueName
    ? (venueCity && !venueName.toLowerCase().includes(venueCity.toLowerCase())
        ? `${venueName}, ${venueCity}`
        : venueName)
    : (venueCity || "TBA");

  let title = match.name;
  if (competition?.competitors && competition.competitors.length >= 2) {
    const homeComp = competition.competitors.find((c: any) => c.homeAway === "home");
    const awayComp = competition.competitors.find((c: any) => c.homeAway === "away");
    if (homeComp && awayComp) {
      const leagueName = match.league?.name || "";
      title = `${homeComp.team?.displayName || "TBA"} vs ${awayComp.team?.displayName || "TBA"}${
        leagueName ? ` (${leagueName})` : ""
      }`;
    }
  }

  return {
    id: String(match.id),
    title: title,
    date: new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Kolkata",
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    }).format(d),
    time: new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Kolkata",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    }).format(d),
    venue: venue,
    timestamp: d.getTime()
  };
}

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

  // 1. Fetch entity and source for the given favorite_entity_id
  const { data: teamData, error: teamError } = await supabase
    .from("favorite_entities")
    .select("*, entity_sources(*)")
    .eq("id", entityId)
    .single();

  if (teamError || !teamData) {
    return NextResponse.json({ error: "Entity not found" }, { status: 404 });
  }

  const sourceData = teamData.entity_sources?.[0];
  if (!sourceData) {
    return NextResponse.json({ error: "No source mapping found for this entity" }, { status: 404 });
  }

  const { provider, external_id } = sourceData;
  const entityName = teamData.entity_name;

  try {
    let schedule: any[] = [];

    const isFootball =
      teamData.sport?.toLowerCase() === "football" ||
      provider === "api-football" ||
      provider === "thesportsdb" ||
      provider === "sofascore" ||
      entityName.toLowerCase().includes("ronaldo");

    if (isFootball) {
      const lowerName = entityName.toLowerCase().trim();
      const lowerExtId = (external_id || "").toLowerCase().trim();

      // Check if it is a FIFA World Cup / tournament entity
      if (lowerExtId === "fifa" || lowerName.includes("fifa") || lowerName.includes("world cup")) {
        try {
          const res = await fetch("https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?dates=2026", {
            next: { revalidate: 21600 }
          });
          if (res.ok) {
            const data = await res.json();
            const events = data.events || [];
            const now = Date.now() - 4 * 3600 * 1000;
            schedule = events
              .map(formatEspnSoccerMatch)
              .filter((m: any) => m.timestamp >= now)
              .sort((a: any, b: any) => a.timestamp - b.timestamp);
          }
        } catch (err) {
          console.error("Error fetching FIFA schedule:", err);
        }
      } else {
        // Known team IDs map for fast and precise resolution
        const KNOWN_TEAM_IDS: Record<string, string[]> = {
          "cristiano ronaldo": ["817", "482"], // Al Nassr + Portugal
          "ronaldo": ["817", "482"],
          "cristiano-ronaldo": ["817", "482"],
          "real madrid": ["86"],
          "real-madrid": ["86"],
          "chennaiyin fc": ["18000"],
          "chennaiyin-fc": ["18000"],
          "chennaiyin": ["18000"],
          "al nassr": ["817"],
          "al-nassr": ["817"],
          "portugal": ["482"],
          "barcelona": ["83"],
          "fc barcelona": ["83"],
          "manchester united": ["360"],
          "arsenal": ["359"],
          "liverpool": ["364"],
          "manchester city": ["382"],
          "chelsea": ["363"],
          "bayern munich": ["132"],
          "paris saint-germain": ["160"],
          "psg": ["160"],
          "juventus": ["111"],
          "inter milan": ["110"],
          "ac milan": ["103"],
          "atletico madrid": ["1068"],
          "kerala blasters fc": ["18005"],
          "kerala blasters": ["18005"],
          "mohun bagan super giant": ["18006"],
          "mohun bagan": ["18006"],
          "mumbai city fc": ["18007"],
          "mumbai city": ["18007"],
          "bengaluru fc": ["18002"],
          "bengaluru": ["18002"]
        };

        let teamIds: string[] = KNOWN_TEAM_IDS[lowerName] || KNOWN_TEAM_IDS[lowerExtId] || [];

        // If not in known dictionary, dynamically search across popular leagues
        if (teamIds.length === 0) {
          const leagues = [
            "eng.1", "esp.1", "ita.1", "ger.1", "fra.1",
            "ind.1", "ksa.1", "uefa.champions", "uefa.europa",
            "uefa.nations", "fifa.world"
          ];

          try {
            const leagueResponses = await Promise.all(
              leagues.map(l =>
                fetch(`https://site.api.espn.com/apis/site/v2/sports/soccer/${l}/teams`, {
                  next: { revalidate: 86400 }
                }).then(r => (r.ok ? r.json() : null)).catch(() => null)
              )
            );

            for (const data of leagueResponses) {
              if (data?.sports?.[0]?.leagues?.[0]?.teams) {
                const teams = data.sports[0].leagues[0].teams;
                const found = teams.find((t: any) => {
                  const tName = (t.team?.name || "").toLowerCase();
                  const tDisplay = (t.team?.displayName || "").toLowerCase();
                  const tShort = (t.team?.shortDisplayName || "").toLowerCase();
                  return (
                    tName === lowerName ||
                    tDisplay === lowerName ||
                    tShort === lowerName ||
                    lowerName.includes(tName) ||
                    tDisplay.includes(lowerName)
                  );
                });
                if (found?.team?.id) {
                  teamIds = [String(found.team.id)];
                  break;
                }
              }
            }
          } catch (err) {
            console.error("Error searching leagues for team:", err);
          }
        }

        if (teamIds.length > 0) {
          try {
            // 1. Fetch upcoming fixtures across all competitions (?fixture=true)
            const scheduleResponses = await Promise.all(
              teamIds.map(id =>
                fetch(`https://site.api.espn.com/apis/site/v2/sports/soccer/all/teams/${id}/schedule?fixture=true`, {
                  next: { revalidate: 3600 }
                }).then(r => (r.ok ? r.json() : null)).catch(() => null)
              )
            );

            const allEvents: any[] = [];
            for (const schedData of scheduleResponses) {
              if (schedData?.events) {
                allEvents.push(...schedData.events);
              }
            }

            // 2. Fetch standard schedule in case today's match is currently ongoing or today
            const liveResponses = await Promise.all(
              teamIds.map(id =>
                fetch(`https://site.api.espn.com/apis/site/v2/sports/soccer/all/teams/${id}/schedule`, {
                  next: { revalidate: 1800 }
                }).then(r => (r.ok ? r.json() : null)).catch(() => null)
              )
            );
            for (const lData of liveResponses) {
              if (lData?.events) {
                for (const ev of lData.events) {
                  if (!allEvents.some(existing => existing.id === ev.id)) {
                    allEvents.push(ev);
                  }
                }
              }
            }

            const now = Date.now() - 4 * 3600 * 1000; // include matches started within last 4 hours
            const formatted = allEvents
              .map(formatEspnSoccerMatch)
              .filter((m: any) => m.timestamp >= now);

            // Deduplicate by match id
            const seenIds = new Set<string>();
            const uniqueMatches: any[] = [];
            for (const m of formatted) {
              if (!seenIds.has(m.id)) {
                seenIds.add(m.id);
                uniqueMatches.push(m);
              }
            }

            uniqueMatches.sort((a, b) => a.timestamp - b.timestamp);
            schedule = uniqueMatches;
          } catch (err) {
            console.error("Error fetching soccer schedule:", err);
          }
        } else {
          console.error("Could not find team ID for football entity:", entityName);
        }
      }
    } else if (provider === 'cricbuzz' || provider === 'cricketdata') {
      const rapidApiKey = process.env.RAPIDAPI_KEY || '';
      
      const fetchRapidApi = async (url: string) => {
          try {
             const r = await fetch(url, {
                 headers: {
                    'x-rapidapi-host': 'cricbuzz-cricket.p.rapidapi.com',
                    'x-rapidapi-key': rapidApiKey
                 },
                 next: { revalidate: 21600 } // Cache for 6 hours
             });
             if (r.ok) {
                return await r.json();
             } else {
                console.error("RapidAPI Error", await r.text());
             }
          } catch (e) {
             console.error('Fetch error', e);
          }
          return null;
      };

      // 1. Fetch all upcoming series lists (International and Women)
      const [intlData, womenData] = await Promise.all([
          fetchRapidApi(`https://cricbuzz-cricket.p.rapidapi.com/series/v1/international`),
          fetchRapidApi(`https://cricbuzz-cricket.p.rapidapi.com/series/v1/women`)
      ]);

      const allSeries: any[] = [];
      const extractSeries = (data: any) => {
          if (data && data.seriesMapProto) {
             for (const month of data.seriesMapProto) {
                 if (month.series) {
                     allSeries.push(...month.series);
                 }
             }
          }
      };
      
      extractSeries(intlData);
      extractSeries(womenData);

      // 2. Filter down to ONLY the series that apply to our entity to save API hits
      const searchName = entityName.toLowerCase()
         .replace(/indian/g, 'india')
         .replace(/\bwomen's\b|\bwomen\b/g, '')
         .replace(/\bmen's\b|\bmen\b/g, '')
         .replace(/\bnational\b/g, '')
         .replace(/\bcricket\b/g, '')
         .replace(/\bteam\b/g, '')
         .trim();

      const isWomensEntity = /\bwomen's\b|\bwomen\b/i.test(entityName);
      const isMensEntity = /\bmen's\b|\bmen\b/i.test(entityName);

      const relevantSeries = allSeries.filter((s: any) => {
          const seriesName = (s.name || '').toLowerCase();
          
          if (searchName === 'icc') {
              const isMainEvent = (seriesName.includes('world cup') || seriesName.includes('champions trophy') || seriesName.includes('test championship')) 
                                  && !seriesName.includes('qualifier') 
                                  && !seriesName.includes('league')
                                  && !seriesName.includes('warm-up')
                                  && !seriesName.includes('u19')
                                  && !seriesName.includes('asia pacific');
              
              if (!isMainEvent) return false;
          } else {
              if (!seriesName.includes(searchName)) return false;
          }

          const isWomensSeries = /\bwomen's\b|\bwomen\b/i.test(seriesName);

          if (isMensEntity && isWomensSeries) return false;
          if (isWomensEntity && !isWomensSeries) return false;

          return true;
      });

      // 3. Fetch matches ONLY for those specific relevant series
      const matchPromises = relevantSeries.map(s => fetchRapidApi(`https://cricbuzz-cricket.p.rapidapi.com/series/v1/${s.id}`));
      const seriesResponses = await Promise.all(matchPromises);

      let allMatches: any[] = [];
      
      seriesResponses.forEach(res => {
          if (res && res.matchDetails) {
              for (const day of res.matchDetails) {
                  const matchWrapper = day.matchDetailsMap;
                  if (matchWrapper && matchWrapper.match) {
                      for (const matchObj of matchWrapper.match) {
                          if (matchObj.matchInfo) {
                              allMatches.push(matchObj.matchInfo);
                          }
                      }
                  }
              }
          }
      });
      
      if (allMatches.length > 0) {
        const now = new Date();
        allMatches = allMatches.filter((m: any) => {
           const matchDate = new Date(parseInt(m.startDate) || Date.now());
           return matchDate > now;
        });

        schedule = allMatches.map((match: any) => {
          const d = new Date(parseInt(match.startDate) || Date.now());
          const team1 = match.team1?.teamName || 'TBA';
          const team2 = match.team2?.teamName || 'TBA';
          const venue = match.venueInfo ? `${match.venueInfo.ground}, ${match.venueInfo.city}` : 'TBA';
          return {
            id: match.matchId,
            title: `${team1} vs ${team2}, ${match.matchDesc} - ${match.seriesName}`,
            date: new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', day: '2-digit', month: '2-digit', year: 'numeric' }).format(d),
            time: new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: false }).format(d),
            venue: venue,
            timestamp: d.getTime()
          };
        }).sort((a: any, b: any) => a.timestamp - b.timestamp);
      } else {
        console.error('RapidAPI Cricbuzz error: Empty Response or No Matches');
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
