-- Run this in Supabase SQL Editor

alter table rooms add column if not exists placed_items jsonb default '[]';
