-- Sports Schema for Multi-Sport Match Tracking
-- Run this in Supabase SQL Editor

-- Leagues table (stores league metadata from API)
create table if not exists public.leagues (
    id text primary key,                    -- API provider's league ID
    name text not null,
    sport text not null,                    -- 'football', 'cricket', 'f1', 'tennis', 'badminton', 'kabaddi'
    country text,
    logo_url text,
    season_id text,                         -- Current active season
    api_provider text not null default 'sportmonks',
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

-- Teams table (stores team metadata from API)
create table if not exists public.teams (
    id text primary key,                    -- API provider's team ID
    league_id text references public.leagues(id) on delete cascade,
    name text not null,
    short_name text,
    sport text not null,
    country text,
    logo_url text,
    venue_name text,
    venue_city text,
    api_provider text not null default 'sportmonks',
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

-- User's favorite teams (extends existing favorite_teams)
alter table public.favorite_teams 
add column if not exists team_id text references public.teams(id) on delete set null,
add column if not exists league_id text references public.leagues(id) on delete set null,
add column if not exists sport text;

-- Matches table (stores upcoming/past matches)
create table if not exists public.matches (
    id text primary key,                    -- API provider's match ID
    league_id text references public.leagues(id) on delete cascade,
    season_id text,
    stage_id text,
    round text,                             -- e.g., "Matchday 1", "Quarter-finals"
    
    home_team_id text references public.teams(id) on delete set null,
    away_team_id text references public.teams(id) on delete set null,
    
    home_score integer,
    away_score integer,
    home_pen_score integer,                 -- For penalty shootouts
    away_pen_score integer,
    
    status text not null,                   -- 'scheduled', 'live', 'finished', 'postponed', 'cancelled'
    venue_name text,
    venue_city text,
    
    starts_at timestamptz not null,         -- UTC kickoff time
    ends_at timestamptz,                    -- Estimated end time
    
    -- Sport-specific data (JSONB for flexibility)
    sport_data jsonb default '{}',
    
    api_provider text not null default 'sportmonks',
    fetched_at timestamptz default now(),
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

-- Indexes for common queries
create index if not exists idx_matches_starts_at on public.matches(starts_at);
create index if not exists idx_matches_status on public.matches(status);
create index if not exists idx_matches_home_team on public.matches(home_team_id);
create index if not exists idx_matches_away_team on public.matches(away_team_id);
create index if not exists idx_matches_league on public.matches(league_id);
create index if not exists idx_favorite_teams_user on public.favorite_teams(user_id);
create index if not exists idx_teams_league on public.teams(league_id);

-- RLS Policies
alter table public.leagues enable row level security;
alter table public.teams enable row level security;
alter table public.matches enable row level security;

-- Leagues/Teams/Matches are readable by all authenticated users (public sports data)
create policy "Sports data readable by authenticated" on public.leagues
    for select using (auth.role() = 'authenticated');

create policy "Sports data readable by authenticated" on public.teams
    for select using (auth.role() = 'authenticated');

create policy "Matches readable by authenticated" on public.matches
    for select using (auth.role() = 'authenticated');

-- User favorite teams policies (already exist, but ensure they're correct)
-- Users can only manage their own favorites
drop policy if exists "Users manage own favorite teams" on public.favorite_teams;
create policy "Users manage own favorite teams" on public.favorite_teams
    for all using (auth.uid() = user_id);

-- Function to get upcoming matches for user's favorite teams
create or replace function public.get_user_upcoming_matches(
    p_user_id uuid,
    p_days_ahead int default 14,
    p_limit int default 50
)
returns table (
    match_id text,
    league_name text,
    sport text,
    home_team text,
    away_team text,
    home_logo text,
    away_logo text,
    starts_at timestamptz,
    status text,
    home_score integer,
    away_score integer,
    venue text,
    round text
) language sql security definer set search_path = public as $$
    select 
        m.id as match_id,
        l.name as league_name,
        l.sport,
        ht.name as home_team,
        at.name as away_team,
        ht.logo_url as home_logo,
        at.logo_url as away_logo,
        m.starts_at,
        m.status,
        m.home_score,
        m.away_score,
        m.venue_name as venue,
        m.round
    from public.matches m
    join public.leagues l on m.league_id = l.id
    left join public.teams ht on m.home_team_id = ht.id
    left join public.teams at on m.away_team_id = at.id
    join public.favorite_teams ft on (
        ft.team_id = m.home_team_id 
        or ft.team_id = m.away_team_id
        or ft.league_id = m.league_id
    )
    where ft.user_id = p_user_id
      and m.starts_at >= now()
      and m.starts_at <= now() + (p_days_ahead || ' days')::interval
      and m.status in ('scheduled', 'live')
    order by m.starts_at asc
    limit p_limit;
$$;

-- Function to get matches by league (for league view)
create or replace function public.get_league_matches(
    p_league_id text,
    p_days_ahead int default 30,
    p_limit int default 100
)
returns table (
    match_id text,
    league_name text,
    sport text,
    home_team text,
    away_team text,
    home_logo text,
    away_logo text,
    starts_at timestamptz,
    status text,
    home_score integer,
    away_score integer,
    venue text,
    round text
) language sql security definer set search_path = public as $$
    select 
        m.id as match_id,
        l.name as league_name,
        l.sport,
        ht.name as home_team,
        at.name as away_team,
        ht.logo_url as home_logo,
        at.logo_url as away_logo,
        m.starts_at,
        m.status,
        m.home_score,
        m.away_score,
        m.venue_name as venue,
        m.round
    from public.matches m
    join public.leagues l on m.league_id = l.id
    left join public.teams ht on m.home_team_id = ht.id
    left join public.teams at on m.away_team_id = at.id
    where m.league_id = p_league_id
      and m.starts_at >= now()
      and m.starts_at <= now() + (p_days_ahead || ' days')::interval
    order by m.starts_at asc
    limit p_limit;
$$;

-- Trigger to update updated_at
create or replace function public.update_updated_at()
returns trigger language plpgsql as $$
begin
    new.updated_at = now();
    return new;
end $$;

create trigger update_leagues_updated_at before update on public.leagues
    for each row execute function public.update_updated_at();
create trigger update_teams_updated_at before update on public.teams
    for each row execute function public.update_updated_at();
create trigger update_matches_updated_at before update on public.matches
    for each row execute function public.update_updated_at();