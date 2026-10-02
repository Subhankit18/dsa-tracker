-- Run this ONCE in Supabase SQL Editor.

alter table public.problem_progress
add column if not exists revision_enabled boolean default false;

alter table public.problem_progress
add column if not exists next_revision_date date;
