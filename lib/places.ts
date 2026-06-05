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
};

// 저장된 모든 핀 불러오기 (최신순)
export async function fetchPlaces(): Promise<Place[]> {
  const { data, error } = await supabase
    .from('places')
    .select('id, name, latitude, longitude, visited_on, memo, address, kakao_place_id')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []) as Place[];
}

// 새 장소 한 건 저장하고, 저장된 결과를 돌려줌
export async function addPlace(place: NewPlace): Promise<Place> {
  const { data, error } = await supabase
    .from('places')
    .insert(place)
    .select('id, name, latitude, longitude, visited_on, memo, address, kakao_place_id')
    .single();

  if (error) throw error;
  return data as Place;
}
