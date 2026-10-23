begin;

-- Review writes now go through the authenticated, rate-limited server route.
-- Removing direct client writes prevents publishable-key abuse and bypassing
-- the application limits for review count and photo uploads.
drop policy if exists "Users create their reviews" on public.reviews;
drop policy if exists "Users update their reviews" on public.reviews;
drop policy if exists "Users delete their reviews" on public.reviews;
drop policy if exists "Reviews are public" on public.reviews;
drop policy if exists "Review images are public" on public.review_images;
drop policy if exists "Users add images to their reviews" on public.review_images;
drop policy if exists "Users delete images from their reviews" on public.review_images;

-- Existing public photo links are retired. The server returns short-lived
-- signed URLs for this private bucket instead.
alter table public.review_images alter column public_url drop not null;
update public.review_images set public_url = null where public_url is not null;

-- Do not expose names, emails, or avatar URLs copied from OAuth identities.
update public.reviews
set author_name = 'Thành viên ' || upper(substr(replace(user_id::text, '-', ''), 1, 4)),
    author_avatar_url = null;

update storage.buckets
set public = false,
    file_size_limit = 5242880,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
where id = 'review-images';

drop policy if exists "Public reads review images" on storage.objects;
drop policy if exists "Users upload review images" on storage.objects;
drop policy if exists "Users delete their review images" on storage.objects;

commit;
