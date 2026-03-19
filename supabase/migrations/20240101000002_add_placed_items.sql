alter table rooms add column if not exists placed_items jsonb default '[]';
