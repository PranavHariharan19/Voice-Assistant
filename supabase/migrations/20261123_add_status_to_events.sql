-- Add status column to events table to support persistent completed/missed status across all devices
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS status text DEFAULT 'pending';
