-- AISA Tracker — schema
-- รันใน Supabase SQL Editor ครั้งเดียว แล้วค่อย seed หลักสูตรด้วย tools/seed.mjs
--
-- หลักการ:
--   * ตารางหลักสูตร (subjects/chapters/los) และคลังโจทย์ = อ่านได้ทุกคนที่ล็อกอิน เขียนได้เฉพาะ admin
--   * ข้อมูลความคืบหน้าทุกอย่างผูก user_id และปิดด้วย RLS — ไม่มีใครเห็นของใคร (ไม่มี leaderboard)

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------- ผู้ใช้

-- รายชื่ออีเมลที่อนุญาต — คนที่ไม่อยู่ในนี้ล็อกอินไม่ได้
create table if not exists allowlist (
  email       text primary key,
  is_admin    boolean not null default false,
  note        text,
  added_at    timestamptz not null default now()
);

create table if not exists profiles (
  id           uuid primary key references auth.users on delete cascade,
  email        text not null,
  display_name text,
  is_admin     boolean not null default false,
  created_at   timestamptz not null default now()
);

-- สร้าง profile อัตโนมัติเมื่อล็อกอินครั้งแรก และปฏิเสธถ้าไม่อยู่ใน allowlist
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  allowed allowlist%rowtype;
begin
  select * into allowed from allowlist where lower(email) = lower(new.email);
  if not found then
    raise exception 'อีเมล % ไม่อยู่ในรายชื่อที่อนุญาต', new.email;
  end if;

  insert into profiles (id, email, display_name, is_admin)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', new.email), allowed.is_admin);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

create or replace function is_admin()
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select coalesce((select is_admin from profiles where id = auth.uid()), false);
$$;

-- ---------------------------------------------------------------- หลักสูตร

create table if not exists subjects (
  code       text primary key,
  group_no   smallint not null check (group_no between 1 and 3),
  group_name text not null,
  name       text not null,
  short_name text not null,
  weight     numeric(4,1) not null,   -- % ของข้อสอบจริง (กลางช่วง)
  weight_min numeric(4,1) not null,
  weight_max numeric(4,1) not null,
  sort       smallint not null
);

create table if not exists chapters (
  id            bigserial primary key,
  subject_code  text not null references subjects on delete cascade,
  number        smallint not null,
  title         text not null default '',
  -- บทที่ถูกแก้ตามเอกสารปรับปรุงครั้งที่ 1/2569 (มีผลตั้งแต่รอบ พ.ค. 2569)
  revised_2569  boolean not null default false,
  unique (subject_code, number)
);

create table if not exists los (
  id          bigserial primary key,
  chapter_id  bigint not null references chapters on delete cascade,
  number      text not null,
  text        text not null,
  unique (chapter_id, number)
);

-- ---------------------------------------------------------------- คลังโจทย์

-- kind:
--   mock     ชุดข้อสอบเสมือนจริง (มีเฉลย อาจไม่มีตัวโจทย์ในระบบ)
--   drill    โจทย์รายวิชาจากไฟล์ตะลุยโจทย์
--   external ชุดที่ไปทำบนระบบอื่น (เช่น finquizz ของ ตลท.) แล้วเอาผลมาบันทึก
create table if not exists question_sets (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  kind         text not null check (kind in ('mock','drill','external')),
  subject_code text references subjects on delete set null,
  source_note  text,
  -- ชุดสำรอง: ห้ามหยิบมาใช้ในโหมดสุ่ม เก็บไว้วัดผลสะอาดก่อนสอบ
  is_holdout   boolean not null default false,
  created_at   timestamptz not null default now()
);

create table if not exists questions (
  id            uuid primary key default gen_random_uuid(),
  set_id        uuid references question_sets on delete cascade,
  ordinal       integer,                       -- เลขข้อในชุด
  subject_code  text references subjects on delete set null,
  chapter_id    bigint references chapters on delete set null,
  los_id        bigint references los on delete set null,
  stem          text,                          -- null = ไม่มีตัวโจทย์ในระบบ (อ่านจาก PDF เอง)
  choices       jsonb,                         -- ["...","...","...","..."] หรือ null
  answer        smallint not null check (answer between 1 and 4),
  explanation   text,
  reference     text,                          -- หนังสืออ้างอิงจากหน้าเฉลย
  is_holdout    boolean not null default false,
  -- false = ห้ามระบบหยิบไปใส่ชุดซ้อม ใช้กับแถวตัวแทนของชุดที่ไปทำบนระบบอื่น
  -- (แถวพวกนั้นไม่มีตัวโจทย์ มีไว้ผูกสถิติรายวิชาเท่านั้น)
  selectable    boolean not null default true,
  created_at    timestamptz not null default now()
);

create index if not exists questions_set_idx      on questions (set_id, ordinal);
create index if not exists questions_subject_idx  on questions (subject_code);
create index if not exists questions_los_idx      on questions (los_id);

-- ---------------------------------------------------------------- การทำข้อสอบ

-- mode: exam = จำลองสนามจริง (หมดเวลาตัดส่ง) · adaptive = ระบบสุ่มตามจุดอ่อน
--       custom = ตั้งเอง · external = บันทึกผลจากระบบอื่น
create table if not exists sessions (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references profiles on delete cascade,
  mode           text not null check (mode in ('exam','adaptive','custom','external')),
  label          text not null,
  set_id         uuid references question_sets on delete set null,
  subject_code   text references subjects on delete set null,
  -- รายการ question.id ตามลำดับที่จะแสดง เก็บตอนสร้างชุดเพื่อให้ลำดับคงที่
  -- ไม่สร้างแถว attempts ล่วงหน้า เพราะชุดที่ทำค้างไว้ไม่ควรถูกนับเป็นตอบผิด
  question_ids   jsonb not null default '[]',
  question_count integer not null,
  time_limit_sec integer,                      -- null = ไม่จำกัด
  started_at     timestamptz not null default now(),
  submitted_at   timestamptz,
  status         text not null default 'active'
                 check (status in ('active','submitted','abandoned')),
  created_at     timestamptz not null default now()
);

create index if not exists sessions_user_idx on sessions (user_id, started_at desc);

create table if not exists attempts (
  id           uuid primary key default gen_random_uuid(),
  session_id   uuid not null references sessions on delete cascade,
  user_id      uuid not null references profiles on delete cascade,
  question_id  uuid references questions on delete cascade,
  ordinal      integer not null,
  chosen       smallint check (chosen between 1 and 4),   -- null = ไม่ได้ตอบ
  is_correct   boolean not null default false,
  seconds      numeric(8,2),
  over_budget  boolean not null default false,            -- ถูกแต่ช้ากว่างบเวลาของวิชา
  answered_at  timestamptz not null default now(),
  unique (session_id, ordinal)
);

create index if not exists attempts_user_q_idx on attempts (user_id, question_id, answered_at desc);

-- ---------------------------------------------------------------- อ่าน / โน้ต / เป้าหมาย

create table if not exists reading_progress (
  user_id     uuid not null references profiles on delete cascade,
  chapter_id  bigint not null references chapters on delete cascade,
  status      text not null default 'todo' check (status in ('todo','reading','done')),
  minutes     integer not null default 0,
  updated_at  timestamptz not null default now(),
  primary key (user_id, chapter_id)
);

create table if not exists notes (
  user_id     uuid not null references profiles on delete cascade,
  los_id      bigint not null references los on delete cascade,
  body        text not null default '',
  updated_at  timestamptz not null default now(),
  primary key (user_id, los_id)
);

create table if not exists user_settings (
  user_id        uuid primary key references profiles on delete cascade,
  exam_date      date,
  target_overall numeric(4,3) not null default 0.75,
  target_group1  numeric(4,3) not null default 0.80,
  daily_quota    integer,                     -- null = ให้ระบบคำนวณเอง
  study_modes    jsonb not null default '{}', -- { "EQ": "read_first" | "drill_along" }
  updated_at     timestamptz not null default now()
);

-- ---------------------------------------------------------------- มุมมองสรุป

-- ความแม่นระดับ LOS: "แม่น" = 2 ครั้งล่าสุดถูกติดกัน และครั้งล่าสุดไม่เกินงบเวลา
-- security_invoker: view ต้องบังคับ RLS ตามสิทธิ์ของคนที่เรียก ไม่ใช่สิทธิ์เจ้าของ view
-- ถ้าไม่ใส่ ใครก็ query สถิติของคนอื่นผ่าน view นี้ได้ ทั้งที่ตาราง attempts ปิด RLS ไว้แล้ว
create or replace view los_mastery with (security_invoker = true) as
with ranked as (
  select
    a.user_id,
    q.los_id,
    a.is_correct,
    a.over_budget,
    row_number() over (partition by a.user_id, q.id order by a.answered_at desc) as rn_q,
    q.id as question_id
  from attempts a
  join questions q on q.id = a.question_id
  where q.los_id is not null
    -- กรองด้วย auth.uid() ในตัว view อีกชั้น เผื่อ security_invoker ไม่ติด
    and a.user_id = auth.uid()
),
latest_two as (
  select user_id, los_id, question_id,
         bool_and(is_correct)                          as both_correct,
         bool_or(rn_q = 1 and over_budget)             as latest_over_budget,
         count(*)                                      as tries
  from ranked
  where rn_q <= 2
  group by user_id, los_id, question_id
)
select
  user_id,
  los_id,
  count(*)                                                              as questions_seen,
  count(*) filter (where both_correct and tries >= 2
                     and not latest_over_budget)                        as mastered,
  round(
    count(*) filter (where both_correct and tries >= 2
                       and not latest_over_budget)::numeric
    / nullif(count(*), 0), 3)                                           as mastery
from latest_two
group by user_id, los_id;

-- ความแม่นรายวิชา ใช้ทุกครั้งที่ตอบ (ไม่ใช่แค่ 2 ครั้งล่าสุด) เพื่อประมาณคะแนน
create or replace view subject_accuracy with (security_invoker = true) as
select
  a.user_id,
  q.subject_code,
  count(*)                                          as answered,
  count(*) filter (where a.is_correct)              as correct,
  round(count(*) filter (where a.is_correct)::numeric
        / nullif(count(*), 0), 4)                   as accuracy,
  round(avg(a.seconds), 1)                          as avg_seconds,
  count(*) filter (where a.over_budget)             as over_budget_count
from attempts a
join questions q on q.id = a.question_id
where q.subject_code is not null
  and a.user_id = auth.uid()
group by a.user_id, q.subject_code;

-- ---------------------------------------------------------------- RLS

alter table allowlist        enable row level security;
alter table profiles         enable row level security;
alter table subjects         enable row level security;
alter table chapters         enable row level security;
alter table los              enable row level security;
alter table question_sets    enable row level security;
alter table questions        enable row level security;
alter table sessions         enable row level security;
alter table attempts         enable row level security;
alter table reading_progress enable row level security;
alter table notes            enable row level security;
alter table user_settings    enable row level security;

-- หลักสูตรและคลังโจทย์: อ่านได้ทุกคนที่ล็อกอิน เขียนได้เฉพาะ admin
do $$
declare t text;
begin
  foreach t in array array['subjects','chapters','los','question_sets','questions'] loop
    execute format('drop policy if exists %I on %I', t || '_read', t);
    execute format('create policy %I on %I for select to authenticated using (true)', t || '_read', t);
    execute format('drop policy if exists %I on %I', t || '_write', t);
    execute format('create policy %I on %I for all to authenticated using (is_admin()) with check (is_admin())', t || '_write', t);
  end loop;
end $$;

-- ข้อมูลส่วนตัว: เห็นและแก้ได้เฉพาะของตัวเอง
do $$
declare t text;
begin
  foreach t in array array['sessions','attempts','reading_progress','notes','user_settings'] loop
    execute format('drop policy if exists %I on %I', t || '_own', t);
    execute format('create policy %I on %I for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())', t || '_own', t);
  end loop;
end $$;

drop policy if exists profiles_self on profiles;
create policy profiles_self on profiles
  for select to authenticated using (id = auth.uid() or is_admin());

drop policy if exists profiles_update_self on profiles;
create policy profiles_update_self on profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists allowlist_admin on allowlist;
create policy allowlist_admin on allowlist
  for all to authenticated using (is_admin()) with check (is_admin());
