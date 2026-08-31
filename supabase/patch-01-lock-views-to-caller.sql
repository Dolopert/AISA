-- Patch 01 — ล็อก view ให้คืนเฉพาะข้อมูลของคนที่เรียกเท่านั้น
--
-- ปัญหา: view ใน Postgres รันด้วยสิทธิ์ของเจ้าของ view ไม่ใช่ของคนเรียก
-- แปลว่า RLS บนตาราง attempts ถูกข้าม และใครก็ query สถิติของคนอื่นได้
-- ทั้งที่ระบบนี้ตกลงกันว่าไม่มี leaderboard ต่างคนต่างเห็นของตัวเอง
--
-- schema.sql เดิมแก้ด้วย security_invoker = true ซึ่งถูกต้อง
-- แต่ patch นี้เพิ่มการกรอง auth.uid() ลงในตัว view ตรง ๆ อีกชั้น
-- เพื่อให้ปลอดภัยแม้ security_invoker จะไม่ติดด้วยเหตุใดก็ตาม
-- (เวอร์ชัน Postgres ไม่รองรับ, ถูก replace ทับ, ย้ายฐานข้อมูล ฯลฯ)
--
-- ผลข้างเคียงที่ตั้งใจ: เรียกด้วย service_role จะได้ 0 แถวเสมอ
-- เพราะไม่มี auth.uid() — ไม่กระทบอะไร เพราะไม่มีโค้ดฝั่ง server ที่ใช้ view เหล่านี้

drop view if exists los_mastery;
drop view if exists subject_accuracy;

-- ความแม่นระดับ LOS: "แม่น" = 2 ครั้งล่าสุดถูกติดกัน และครั้งล่าสุดไม่เกินงบเวลา
create view los_mastery with (security_invoker = true) as
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
    and a.user_id = auth.uid()
),
latest_two as (
  select user_id, los_id, question_id,
         bool_and(is_correct)              as both_correct,
         bool_or(rn_q = 1 and over_budget) as latest_over_budget,
         count(*)                          as tries
  from ranked
  where rn_q <= 2
  group by user_id, los_id, question_id
)
select
  user_id,
  los_id,
  count(*)                                                        as questions_seen,
  count(*) filter (where both_correct and tries >= 2
                     and not latest_over_budget)                  as mastered,
  round(
    count(*) filter (where both_correct and tries >= 2
                       and not latest_over_budget)::numeric
    / nullif(count(*), 0), 3)                                     as mastery
from latest_two
group by user_id, los_id;

-- ความแม่นรายวิชา ใช้ทุกครั้งที่ตอบ เพื่อประมาณคะแนน
create view subject_accuracy with (security_invoker = true) as
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

-- ตรวจผล: ต้องเห็น {security_invoker=true} ทั้งสองแถว
select c.relname as view_name, c.reloptions
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'v'
  and c.relname in ('los_mastery', 'subject_accuracy');
