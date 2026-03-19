alter table rooms add column if not exists coins integer default 0;
alter table rooms add column if not exists items jsonb default '[]';
alter table rooms add column if not exists coins_awarded boolean default false;
