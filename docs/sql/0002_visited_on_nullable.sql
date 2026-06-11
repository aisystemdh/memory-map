-- =========================================================
-- 추억 지도 — visited_on NULL 허용 (B2 후속 수정)
-- 원인: 0001에서 빠진 완화 단계. 기존 places.visited_on은 NOT NULL이라
--       '가보고 싶은 곳'(status='want', visited_on=NULL) 저장이 23502로 실패했다.
-- 규칙: visited면 visited_on 필수, want/imported면 NULL (schema-plan.md 일관성 규칙)
-- =========================================================

alter table places alter column visited_on drop not null;

-- 일관성 규칙을 DB에서도 강제 (visited ↔ 날짜 있음, want/imported ↔ 날짜 없음)
alter table places drop constraint if exists places_status_visited_on_check;
alter table places add constraint places_status_visited_on_check
  check (
    (status = 'visited' and visited_on is not null)
    or (status in ('want', 'imported') and visited_on is null)
  );
