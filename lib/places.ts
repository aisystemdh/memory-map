import { supabase } from './supabase';

// 장소 상태: 가본 곳 / 가보고 싶은 곳 / 가져온 곳(D2에서 사용 예정)
export type PlaceStatus = 'visited' | 'want' | 'imported';

// 지도에 표시하는 저장된 장소(핀) 한 건
export type Place = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  status: PlaceStatus;
  visited_on: string | null; // YYYY-MM-DD. visited면 필수, want/imported면 NULL
  plan_date: string | null; // YYYY-MM-DD. want의 계획일 (미정이면 NULL → 루트엔 안 들어감)
  plan_with: string | null; // 누구랑 갈지 (선택). 나중에 친구 연동으로 확장 예정.
  memo: string | null;
  address: string | null;
  kakao_place_id: string | null;
  category_id: string | null; // 카테고리 (null = 분류 없음)
  source: string | null; // 가져온 루트의 출처 (D2). 체크인해도 지우지 않는다.
  created_at: string; // 같은 날 안에서 시간순 정렬에 사용
};

// 새 장소를 저장할 때 넘기는 값
export type NewPlace = {
  name: string;
  latitude: number;
  longitude: number;
  status: PlaceStatus;
  visited_on: string | null;
  plan_date: string | null;
  plan_with: string | null;
  memo: string | null;
  address: string | null;
  kakao_place_id: string | null;
  category_id: string | null;
};

const PLACE_COLUMNS =
  'id, name, latitude, longitude, status, visited_on, plan_date, plan_with, memo, address, kakao_place_id, category_id, source, created_at';

// 저장된 모든 핀 불러오기 (최신순)
export async function fetchPlaces(): Promise<Place[]> {
  const { data, error } = await supabase
    .from('places')
    .select(PLACE_COLUMNS)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []) as Place[];
}

// Date를 YYYY-MM-DD 문자열로 (현지 시간 기준)
export function todayString(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// 새 장소 한 건 저장하고, 저장된 결과를 돌려줌
export async function addPlace(place: NewPlace): Promise<Place> {
  // 데이터 일관성 규칙: visited는 visited_on 사용(필수), want는 plan_date 사용(선택)
  if (place.status === 'visited' && !place.visited_on) {
    throw new Error('다녀온 곳은 방문 날짜가 필요합니다.');
  }
  const row: NewPlace =
    place.status === 'visited'
      ? { ...place, plan_date: null, plan_with: null }
      : { ...place, visited_on: null };

  const { data, error } = await supabase
    .from('places')
    .insert(row)
    .select(PLACE_COLUMNS)
    .single();

  if (error) throw error;
  return data as Place;
}

// 체크인: '가보고 싶은 곳'을 '다녀온 곳'으로 바꾸고 방문 날짜를 오늘로 채운다.
// 메모는 선택사항 — 입력했을 때만 저장한다(비우면 기존 값 유지).
// status/visited_on(/memo)만 갱신하므로 source 등 다른 값은 그대로 보존된다.
export async function checkInPlace(
  placeId: string,
  memo?: string
): Promise<{ visited_on: string; memo: string | null }> {
  const visited_on = todayString();
  const trimmed = memo?.trim() || '';
  const update: { status: PlaceStatus; visited_on: string; memo?: string } = {
    status: 'visited',
    visited_on,
  };
  if (trimmed) update.memo = trimmed;

  const { error } = await supabase.from('places').update(update).eq('id', placeId);

  if (error) throw error;
  return { visited_on, memo: trimmed || null };
}

// 저장된 장소의 카테고리만 변경 (null이면 분류 해제)
export async function updatePlaceCategory(
  placeId: string,
  categoryId: string | null
): Promise<void> {
  const { error } = await supabase
    .from('places')
    .update({ category_id: categoryId })
    .eq('id', placeId);

  if (error) throw error;
}
