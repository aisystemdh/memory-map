import { supabase } from './supabase';
import { getCurrentUserId } from './currentUser';

// 한 장소의 방문 1건. 한 place에 여러 visit이 매달릴 수 있다.
// 방문일·메모는 여기에 있다(places에는 없다). user_id 컬럼은 없고,
// RLS가 "부모 place가 본인 것일 때만"으로 접근을 제어한다.
export type Visit = {
  id: string;
  place_id: string;
  visited_on: string; // YYYY-MM-DD (NOT NULL)
  memo: string | null;
  created_at: string;
};

const VISIT_COLUMNS = 'id, place_id, visited_on, memo, created_at';

// 내 모든 방문 — 최근 방문일 먼저(visited_on 내림차순, 같은 날은 created_at 내림차순).
// 동선·달력·카드 슬라이드·목록 정렬이 전부 이 목록에서 파생된다.
//
// ★ RLS가 친구 공개 장소의 visits까지 돌려주므로(소셜 단계),
//   여기서 반드시 "내 장소의 방문만"으로 한정한다(places!inner 조인 + 내 user_id).
//   이 한정이 없으면 친구 방문이 내 지도 동선·달력에 섞인다.
export async function fetchAllVisits(): Promise<Visit[]> {
  const userId = await getCurrentUserId();
  const { data, error } = await supabase
    .from('visits')
    .select(`${VISIT_COLUMNS}, places!inner(user_id)`)
    .eq('places.user_id', userId)
    .order('visited_on', { ascending: false })
    .order('created_at', { ascending: false });
  if (error) throw error;
  // 조인으로 따라온 places 필드는 떼고 Visit 형태로 돌려준다.
  return (data ?? []).map((row: any) => ({
    id: row.id,
    place_id: row.place_id,
    visited_on: row.visited_on,
    memo: row.memo,
    created_at: row.created_at,
  })) as Visit[];
}

// 한 장소에 방문 한 건 추가. 사진은 호출부가 돌려받은 visit.id로 따로 올린다.
export async function addVisit(
  placeId: string,
  visitedOn: string,
  memo: string
): Promise<Visit> {
  const { data, error } = await supabase
    .from('visits')
    .insert({ place_id: placeId, visited_on: visitedOn, memo: memo.trim() || null })
    .select(VISIT_COLUMNS)
    .single();
  if (error) throw error;
  return data as Visit;
}
