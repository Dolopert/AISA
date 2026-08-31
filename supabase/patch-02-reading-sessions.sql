-- Patch 02 — บันทึกการอ่านรายครั้ง
--
-- ตาราง reading_progress เดิมเก็บ "สถานะล่าสุด + นาทีสะสม" ของแต่ละบท
-- ซึ่งตอบไม่ได้ว่า "วันนี้อ่านไปกี่นาที" หรือ "สัปดาห์นี้ตามแผนทันไหม"
-- จึงเพิ่มตารางบันทึกรายครั้ง แล้วให้ยอดสะสมคำนวณจากตรงนี้แทน

create table if not exists reading_sessions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references profiles on delete cascade,
  chapter_id  bigint references chapters on delete set null,
  -- วันที่ที่นับเป็นของการอ่านครั้งนี้ (เวลาไทย) ใช้รวมยอดรายวัน
  studied_on  date not null default (now() at time zone 'Asia/Bangkok')::date,
  minutes     integer not null check (minutes > 0 and minutes <= 720),
  -- timer = กดเริ่ม/หยุดจริง · manual = กรอกย้อนหลัง
  -- แยกไว้เพราะความน่าเชื่อถือต่างกัน และควรรู้ว่าตัวเลขมาจากไหน
  source      text not null default 'timer' check (source in ('timer', 'manual')),
  note        text,
  created_at  timestamptz not null default now()
);

create index if not exists reading_sessions_user_day_idx
  on reading_sessions (user_id, studied_on desc);
create index if not exists reading_sessions_chapter_idx
  on reading_sessions (user_id, chapter_id);

alter table reading_sessions enable row level security;

drop policy if exists reading_sessions_own on reading_sessions;
create policy reading_sessions_own on reading_sessions
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- นาทีสะสมรายบท คำนวณจากบันทึกรายครั้ง ไม่ต้องมาคอยบวกเองให้พลาด
create or replace view chapter_minutes_spent with (security_invoker = true) as
select
  user_id,
  chapter_id,
  sum(minutes)          as minutes,
  count(*)              as sessions,
  max(studied_on)       as last_studied_on
from reading_sessions
where user_id = auth.uid()
  and chapter_id is not null
group by user_id, chapter_id;

-- ยอดอ่านรายวัน ใช้เทียบกับโควตาที่ระบบคำนวณถอยหลังจากวันสอบ
create or replace view daily_reading with (security_invoker = true) as
select
  user_id,
  studied_on,
  sum(minutes) as minutes,
  count(*)     as sessions
from reading_sessions
where user_id = auth.uid()
group by user_id, studied_on;

-- reading_progress ไม่ต้องเก็บ minutes อีกต่อไป ให้เหลือแค่สถานะการติ๊ก
-- (คงคอลัมน์ไว้ก่อนเพื่อไม่ให้ข้อมูลเดิมหาย แต่โค้ดไม่ใช้แล้ว)
comment on column reading_progress.minutes is
  'เลิกใช้แล้ว — นาทีสะสมมาจาก view chapter_minutes_spent';
