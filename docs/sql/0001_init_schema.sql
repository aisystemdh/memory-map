-- =========================================================
-- 추억 지도 — 스키마 1차 적용 (로그인 이전, A1~B3용)
-- 전제: 기존 places/place_photos 데이터는 전부 테스트용 → 폐기
-- 로그인·user_id·RLS·CASCADE 체인은 C1 단계에서 별도 적용
-- =========================================================

-- 0) 기존 사진 테이블 폐기 + 테스트 장소 데이터 삭제
drop table if exists place_photos cascade;
delete from places;

-- 1) categories (커스텀 분류) — user_id는 C1에서 추가
create table if not exists categories (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  color       text not null,                 -- hex 문자열, 예: '#1d4ed8'
  created_at  timestamptz not null default now()
);

-- 2) places 확장 (기존 id/name/lat/lng/visited_on/메모 유지)
alter table places
  add column if not exists category_id uuid
    references categories(id) on delete set null,
  add column if not exists status text not null
    check (status in ('visited','want','imported')),
  add column if not exists source text;

-- 3) place_photos 재정의 (빈 상태였으므로 깔끔히 재생성)
create table place_photos (
  id           uuid primary key default gen_random_uuid(),
  place_id     uuid not null references places(id) on delete cascade,
  storage_path text not null,                -- Storage 안 파일 경로만 저장
  created_at   timestamptz not null default now()
);

-- 4) 인덱스 (user_id 관련 인덱스는 C1에서)
create index if not exists idx_places_visited_on  on places(visited_on);
create index if not exists idx_places_category_id on places(category_id);
create index if not exists idx_place_photos_place on place_photos(place_id);
