-- Migration: Create routine_tasks table with Row Level Security (RLS)
-- Run this in your Supabase Project's SQL Editor (Dashboard -> SQL Editor):

-- 1. Create table for daily recurring routine tasks
CREATE TABLE IF NOT EXISTS public.routine_tasks (
    id TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    time TEXT,
    completed BOOLEAN DEFAULT false,
    last_completed_date TEXT,
    position INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Indexes for fast user-specific ordering
CREATE INDEX IF NOT EXISTS idx_routine_tasks_user_id ON public.routine_tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_routine_tasks_position ON public.routine_tasks(user_id, position ASC);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.routine_tasks ENABLE ROW LEVEL SECURITY;

-- 4. Clean up any existing conflicting policies
DROP POLICY IF EXISTS "Users can view own routine tasks" ON public.routine_tasks;
DROP POLICY IF EXISTS "Users can insert own routine tasks" ON public.routine_tasks;
DROP POLICY IF EXISTS "Users can update own routine tasks" ON public.routine_tasks;
DROP POLICY IF EXISTS "Users can delete own routine tasks" ON public.routine_tasks;

-- 5. RLS Policies
CREATE POLICY "Users can view own routine tasks"
    ON public.routine_tasks
    FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own routine tasks"
    ON public.routine_tasks
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own routine tasks"
    ON public.routine_tasks
    FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own routine tasks"
    ON public.routine_tasks
    FOR DELETE
    USING (auth.uid() = user_id);
