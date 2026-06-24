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

    if (entityName.toLowerCase().includes('ronaldo')) {
      // Pull Portugal matches from the World Cup 2026 repository
      const [matchesRes, teamsRes, stadiumsRes] = await Promise.all([
          fetch('https://raw.githubusercontent.com/rezarahiminia/worldcup2026/main/football.matches.json'),
          fetch('https://raw.githubusercontent.com/rezarahiminia/worldcup2026/main/football.teams.json'),
          fetch('https://raw.githubusercontent.com/rezarahiminia/worldcup2026/main/football.stadiums.json')
      ]);

      if (matchesRes.ok && teamsRes.ok && stadiumsRes.ok) {
          const matches = await matchesRes.json();
          const teams = await teamsRes.json();
          const stadiums = await stadiumsRes.json();

          const teamMap = new Map(teams.map((t: any) => [t.id, t.name_en]));
          const stadiumMap = new Map(stadiums.map((s: any) => [s.id, s.name_en]));

          const portugalMatches = matches.filter((m: any) => {
              const home = teamMap.get(m.home_team_id) || '';
              const away = teamMap.get(m.away_team_id) || '';
              return home === 'Portugal' || away === 'Portugal';
          });

          const allFixtures = portugalMatches.map((m: any) => {
              const homeTeam = teamMap.get(m.home_team_id) || 'TBA';
              const awayTeam = teamMap.get(m.away_team_id) || 'TBA';
              const stadium = stadiumMap.get(m.stadium_id) || 'TBA';
              
              const [datePart, timePart] = m.local_date.split(' ');
              const [month, day, year] = datePart.split('/');
              const dateObj = new Date(`${year}-${month}-${day}T${timePart}:00Z`);

              return {
                  id: m.id,
                  name: `${homeTeam} vs ${awayTeam}`,
                  date: dateObj.toISOString(),
                  venue: stadium
              };
          });

          const now = new Date();
          const upcoming = allFixtures.filter((e: any) => new Date(e.date) > now);

          if (upcoming.length > 0) {
             schedule = upcoming.map((match: any) => {
                const d = new Date(match.date);
                return {
                   id: match.id,
                   title: match.name,
                   date: new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', day: '2-digit', month: '2-digit', year: 'numeric' }).format(d),
                   time: new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: false }).format(d),
                   venue: match.venue || 'TBA'
                };
             });
          } else {
             console.error('World Cup 2026: No upcoming fixtures found for Portugal (Ronaldo)');
          }
      } else {
          console.error('World Cup 2026 fetch failed for Ronaldo');
      }
    } else if (provider === 'api-football' || provider === 'thesportsdb' || provider === 'sofascore') {
      let allFixtures: any[] = [];
      try {
        const leagues = ['eng.1', 'esp.1', 'ita.1', 'ger.1', 'fra.1', 'uefa.champions', 'uefa.europa', 'fifa.world'];
        let teamId = null;
        let foundLeague = null;

        // Use World Cup 2026 Github repo for FIFA
        if (external_id === 'fifa' || entityName.toLowerCase().includes('fifa') || entityName.toLowerCase().includes('world cup')) {
           const [matchesRes, teamsRes, stadiumsRes] = await Promise.all([
               fetch('https://raw.githubusercontent.com/rezarahiminia/worldcup2026/main/football.matches.json'),
               fetch('https://raw.githubusercontent.com/rezarahiminia/worldcup2026/main/football.teams.json'),
               fetch('https://raw.githubusercontent.com/rezarahiminia/worldcup2026/main/football.stadiums.json')
           ]);

           if (matchesRes.ok && teamsRes.ok && stadiumsRes.ok) {
               const matches = await matchesRes.json();
               const teams = await teamsRes.json();
               const stadiums = await stadiumsRes.json();

               const teamMap = new Map(teams.map((t: any) => [t.id, t.name_en]));
               const stadiumMap = new Map(stadiums.map((s: any) => [s.id, s.name_en]));

               allFixtures = matches.map((m: any) => {
                   const homeTeam = teamMap.get(m.home_team_id) || 'TBA';
                   const awayTeam = teamMap.get(m.away_team_id) || 'TBA';
                   const stadium = stadiumMap.get(m.stadium_id) || 'TBA';
                   
                   // local_date is MM/DD/YYYY HH:MM
                   const [datePart, timePart] = m.local_date.split(' ');
                   const [month, day, year] = datePart.split('/');
                   const dateObj = new Date(`${year}-${month}-${day}T${timePart}:00Z`); // Treat as UTC for sorting

                   return {
                       id: m.id,
                       name: `${homeTeam} vs ${awayTeam}`,
                       date: dateObj.toISOString(),
                       venue: stadium
                   };
               });

               const now = new Date();
               const upcoming = allFixtures.filter((e: any) => new Date(e.date) > now);
               allFixtures = upcoming.length > 0 ? upcoming : allFixtures;
           }
        } else {
          // Use ESPN for standard teams
          for (const l of leagues) {
             const res = await fetch(`https://site.api.espn.com/apis/site/v2/sports/soccer/${l}/teams`);
             if(res.ok) {
                const data = await res.json();
                if (data.sports && data.sports[0] && data.sports[0].leagues && data.sports[0].leagues[0]) {
                   const team = data.sports[0].leagues[0].teams.find((t: any) => 
                       t.team.name.toLowerCase() === entityName.toLowerCase() || 
                       t.team.displayName.toLowerCase() === entityName.toLowerCase() ||
                       t.team.shortDisplayName.toLowerCase() === entityName.toLowerCase()
                   );
                   if(team) { 
                      teamId = team.team.id; 
                      foundLeague = l;
                      break; 
                   }
                }
             }
          }

          if (teamId && foundLeague) {
             const scheduleRes = await fetch(`https://site.api.espn.com/apis/site/v2/sports/soccer/${foundLeague}/teams/${teamId}/schedule`);
             if (scheduleRes.ok) {
                 const scheduleData = await scheduleRes.json();
                 const events = scheduleData.events || [];
                 
                 const now = new Date();
                 const upcoming = events.filter((e: any) => new Date(e.date) > now);

                 allFixtures = upcoming.length > 0 ? upcoming : events.slice(-5);
             }
          }
        }
      } catch (err) {
        console.error('ESPN fetch error:', err);
      }

      if (allFixtures.length > 0) {
        schedule = allFixtures.map((match: any) => {
          const d = new Date(match.date);
          return {
            id: match.id,
            title: match.name,
            date: new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', day: '2-digit', month: '2-digit', year: 'numeric' }).format(d),
            time: new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: false }).format(d),
            venue: match.venue || 'TBA'
          };
        });
      } else {
        console.error('ESPN: No upcoming fixtures found for', entityName);
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
