import { supabase } from './supabase';

// 지도에 표시하는 저장된 장소(핀) 한 건
export type Place = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  visited_on: string; // YYYY-MM-DD
  memo: string | null;
  address: string | null;
  kakao_place_id: string | null;
  category_id: string | null; // 카테고리 (null = 분류 없음)
  created_at: string; // 같은 날 안에서 시간순 정렬에 사용
};

// 새 장소를 저장할 때 넘기는 값
export type NewPlace = {
  name: string;
  latitude: number;
  longitude: number;
  visited_on: string;
  memo: string | null;
  address: string | null;
  kakao_place_id: string | null;
  category_id: string | null;
};

const PLACE_COLUMNS =
  'id, name, latitude, longitude, visited_on, memo, address, kakao_place_id, category_id, created_at';

// 저장된 모든 핀 불러오기 (최신순)
export async function fetchPlaces(): Promise<Place[]> {
  const { data, error } = await supabase
    .from('places')
    .select(PLACE_COLUMNS)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []) as Place[];
}

// 새 장소 한 건 저장하고, 저장된 결과를 돌려줌
export async function addPlace(place: NewPlace): Promise<Place> {
  const { data, error } = await supabase
    .from('places')
    // status는 NOT NULL(기본값 없음)이라 항상 명시해야 한다.
    // 이 화면은 "다녀온 곳 + 날짜"를 기록하는 흐름이므로 'visited' 고정.
    .insert({ ...place, status: 'visited' })
    .select(PLACE_COLUMNS)
    .single();

  if (error) throw error;
  return data as Place;
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
