import { supabase } from './supabase';
import { getCurrentUserId } from './currentUser';

// 장소 상태: 가본 곳 / 가보고 싶은 곳 / 가져온 곳(D2에서 사용 예정)
export type PlaceStatus = 'visited' | 'want' | 'imported';

// 공개 범위 (소셜은 D단계). 지금은 항상 'private'로 저장한다.
export type PlaceVisibility = 'private' | 'friends' | 'public';

// 지도에 표시하는 저장된 장소(핀) 한 건 — "정체성"만 담는다.
// 방문일·메모·사진은 visits/visit_photos에 있다(이 타입에 없다).
export type Place = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  status: PlaceStatus;
  plan_date: string | null; // YYYY-MM-DD. want의 계획일 (미정이면 NULL → 루트엔 안 들어감)
  plan_with: string | null; // 누구랑 갈지 (선택). 나중에 친구 연동으로 확장 예정.
  address: string | null; // 카카오에서 받은 주소
  kakao_place_id: string | null; // 카카오 장소 고유 ID (중복 저장 방지·재방문 연결에 사용)
  category_id: string | null; // 카테고리 (null = 분류 없음)
  source: string | null; // 가져온 루트의 출처 (D2). 체크인해도 지우지 않는다.
  visibility: PlaceVisibility;
  friend_note: string | null; // 친구에게 보여줄 한마디 (friends 공개 시). 사적 메모(visits.memo)와 별개.
  created_at: string;
};

// 새 장소를 저장할 때 넘기는 값 (정체성만 — 방문 정보는 visits로 따로 저장)
export type NewPlace = {
  name: string;
  latitude: number;
  longitude: number;
  status: PlaceStatus;
  plan_date: string | null;
  plan_with: string | null;
  address: string | null;
  kakao_place_id: string | null;
  category_id: string | null;
  visibility: PlaceVisibility; // 'private'(나만) | 'friends'(친구에게 공개). public은 UI에 노출 안 함
  friend_note: string | null; // 친구에게 보여줄 한마디 (friends일 때만 값, 아니면 null)
};

const PLACE_COLUMNS =
  'id, name, latitude, longitude, status, plan_date, plan_with, address, kakao_place_id, category_id, source, visibility, friend_note, created_at';

// 저장된 모든 핀 불러오기 (최신순)
// RLS가 본인 행만 돌려주지만, 코드에서도 user_id로 한 번 더 한정한다(보조 방어).
export async function fetchPlaces(): Promise<Place[]> {
  const userId = await getCurrentUserId();
  const { data, error } = await supabase
    .from('places')
    .select(PLACE_COLUMNS)
    .eq('user_id', userId)
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

// 새 장소(정체성) 한 건 저장. visited여도 방문(visits)은 호출부가 따로 만든다.
// 공개범위(visibility)는 저장 모달에서 고른 값을 그대로 쓴다(기본은 모달이 'private'로 둠).
export async function addPlace(place: NewPlace): Promise<Place> {
  // visited는 계획값(plan_*)을 두지 않는다. want/imported는 plan_date(선택)만.
  const normalized: NewPlace =
    place.status === 'visited' ? { ...place, plan_date: null, plan_with: null } : place;
  // 소유자는 현재 로그인 사용자
  const userId = await getCurrentUserId();
  const row = { ...normalized, user_id: userId };

  const { data, error } = await supabase
    .from('places')
    .insert(row)
    .select(PLACE_COLUMNS)
    .single();

  if (error) throw error;
  return data as Place;
}

// 저장된 장소의 공개범위 변경 (나만 보기 ↔ 친구에게 공개).
// friends로 바꿀 때는 친구 한마디(friend_note)도 함께 저장한다.
// private로 바꿀 때는 friend_note를 건드리지 않는다(친구가 그 장소를 못 보므로 남아 있어도 무방).
export async function updatePlaceVisibility(
  placeId: string,
  visibility: PlaceVisibility,
  friendNote?: string | null
): Promise<void> {
  const userId = await getCurrentUserId();
  const update: { visibility: PlaceVisibility; friend_note?: string | null } = { visibility };
  if (friendNote !== undefined) update.friend_note = friendNote;
  const { error } = await supabase
    .from('places')
    .update(update)
    .eq('id', placeId)
    .eq('user_id', userId);
  if (error) throw error;
}

// 장소 상태를 '다녀온 곳'으로 전환 (가볼→가본 체크인 시).
// source 등 다른 값은 건드리지 않는다. 방문 한 건은 호출부가 visits에 따로 추가한다.
export async function markPlaceVisited(placeId: string): Promise<void> {
  const userId = await getCurrentUserId();
  const { error } = await supabase
    .from('places')
    .update({ status: 'visited' })
    .eq('id', placeId)
    .eq('user_id', userId);
  if (error) throw error;
}

// 저장된 장소의 카테고리만 변경 (null이면 분류 해제)
export async function updatePlaceCategory(
  placeId: string,
  categoryId: string | null
): Promise<void> {
  const userId = await getCurrentUserId();
  const { error } = await supabase
    .from('places')
    .update({ category_id: categoryId })
    .eq('id', placeId)
    .eq('user_id', userId);

  if (error) throw error;
}
