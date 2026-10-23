create extension if not exists pgcrypto;

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  place_id text not null check (char_length(place_id) between 1 and 300),
  place_name text not null check (char_length(place_name) between 1 and 200),
  user_id uuid not null references auth.users(id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  body text not null check (char_length(body) between 10 and 1000),
  author_name text not null check (char_length(author_name) between 1 and 100),
  author_avatar_url text check (author_avatar_url is null or (char_length(author_avatar_url) <= 500 and author_avatar_url like 'https://%')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (place_id, user_id)
);

create index if not exists reviews_place_created_idx on public.reviews (place_id, created_at desc);

create table if not exists public.review_images (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.reviews(id) on delete cascade,
  storage_path text not null unique,
  public_url text check (public_url is null or (char_length(public_url) <= 1000 and public_url like 'https://%')),
  sort_order smallint not null default 0 check (sort_order between 0 and 3),
  created_at timestamptz not null default now()
);

create or replace function public.set_dateny_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists reviews_set_updated_at on public.reviews;
create trigger reviews_set_updated_at
before update on public.reviews
for each row execute function public.set_dateny_updated_at();

alter table public.reviews enable row level security;
alter table public.review_images enable row level security;

drop policy if exists "Reviews are public" on public.reviews;

drop policy if exists "Users create their reviews" on public.reviews;
drop policy if exists "Users update their reviews" on public.reviews;
drop policy if exists "Users delete their reviews" on public.reviews;

drop policy if exists "Review images are public" on public.review_images;

drop policy if exists "Users add images to their reviews" on public.review_images;
drop policy if exists "Users delete images from their reviews" on public.review_images;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('review-images', 'review-images', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public reads review images" on storage.objects;
drop policy if exists "Users upload review images" on storage.objects;
drop policy if exists "Users delete their review images" on storage.objects;

