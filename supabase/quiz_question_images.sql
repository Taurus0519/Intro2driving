alter table public.quiz_questions
  add column if not exists image_path text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'quiz-question-images',
  'quiz-question-images',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Quiz admins upload question images" on storage.objects;
create policy "Quiz admins upload question images"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'quiz-question-images'
  and exists (
    select 1
    from public.profiles
    where profiles.id = (select auth.uid())
      and profiles.role in ('admin', 'superadmin')
  )
);

drop policy if exists "Quiz admins delete question images" on storage.objects;
create policy "Quiz admins delete question images"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'quiz-question-images'
  and exists (
    select 1
    from public.profiles
    where profiles.id = (select auth.uid())
      and profiles.role in ('admin', 'superadmin')
  )
);
