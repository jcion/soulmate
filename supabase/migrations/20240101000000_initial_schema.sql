create table if not exists rooms (
  id uuid default gen_random_uuid() primary key,
  code text unique not null,
  player_a text,
  player_b text,
  puzzle_index integer default 0,
  answers jsonb default '{}',
  status text default 'waiting',
  created_at timestamp with time zone default now()
);

alter publication supabase_realtime add table rooms;

alter table rooms enable row level security;
create policy "Allow all" on rooms for all using (true) with check (true);
