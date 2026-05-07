-- Ejecuta este código completo en el SQL Editor de Supabase
-- Ve a: tu proyecto → SQL Editor → New Query → pega esto → Run

-- 1. Tabla principal de lecciones
create table if not exists lessons (
  id uuid default gen_random_uuid() primary key,
  date date not null unique,
  created_at timestamp with time zone default now()
);

-- 2. Vocabulario (10 palabras por lección)
create table if not exists vocabulary (
  id uuid default gen_random_uuid() primary key,
  lesson_id uuid references lessons(id) on delete cascade,
  word text,
  meaning text,
  example text,
  position integer default 0
);

-- 3. Speaking tasks
create table if not exists speaking_tasks (
  id uuid default gen_random_uuid() primary key,
  lesson_id uuid references lessons(id) on delete cascade,
  activity text,
  transcription text,
  corrections text,
  audio_url text
);

-- 4. Writing tasks
create table if not exists writing_tasks (
  id uuid default gen_random_uuid() primary key,
  lesson_id uuid references lessons(id) on delete cascade,
  activity text,
  written_text text,
  corrections text
);

-- 5. Políticas de acceso público (para uso personal sin login)
alter table lessons enable row level security;
alter table vocabulary enable row level security;
alter table speaking_tasks enable row level security;
alter table writing_tasks enable row level security;

create policy "Allow all" on lessons for all using (true) with check (true);
create policy "Allow all" on vocabulary for all using (true) with check (true);
create policy "Allow all" on speaking_tasks for all using (true) with check (true);
create policy "Allow all" on writing_tasks for all using (true) with check (true);

-- 6. Storage bucket para audios
insert into storage.buckets (id, name, public) values ('audios', 'audios', true)
on conflict do nothing;

create policy "Allow audio uploads" on storage.objects
  for all using (bucket_id = 'audios') with check (bucket_id = 'audios');
