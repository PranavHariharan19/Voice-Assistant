-- Fix Row Level Security (RLS) policies for favorite_entities and entity_sources
-- Run this in your Supabase Project's SQL Editor (Dashboard -> SQL Editor):

-- 1. Ensure RLS is active on both tables
ALTER TABLE public.favorite_entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entity_sources ENABLE ROW LEVEL SECURITY;

-- 2. Clean up existing conflicting policies if any exist
DROP POLICY IF EXISTS "Allow select for all" ON public.favorite_entities;
DROP POLICY IF EXISTS "Users can view own favorite entities" ON public.favorite_entities;
DROP POLICY IF EXISTS "Users manage own favorite entities" ON public.favorite_entities;
DROP POLICY IF EXISTS "Allow select favorite entities" ON public.favorite_entities;
DROP POLICY IF EXISTS "Allow select entity sources" ON public.entity_sources;

-- 3. Allow SELECT on favorite_entities
-- This allows both global entities (where user_id IS NULL) and user favorites to be read by the sports page & API
CREATE POLICY "Allow select favorite entities" ON public.favorite_entities
    FOR SELECT USING (true);

-- Allow authenticated users to manage their own favorite entities if needed
CREATE POLICY "Users can insert own favorite entities" ON public.favorite_entities
    FOR INSERT WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Users can update own favorite entities" ON public.favorite_entities
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own favorite entities" ON public.favorite_entities
    FOR DELETE USING (auth.uid() = user_id);

-- 4. Allow SELECT on entity_sources (used by /api/sports/schedule and team relation joins)
CREATE POLICY "Allow select entity sources" ON public.entity_sources
    FOR SELECT USING (true);
