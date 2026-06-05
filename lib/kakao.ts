// 카카오 로컬 키워드 검색 결과 한 건의 형태
export type KakaoPlace = {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  category: string;
};

// 카카오 API 원본 응답 중 우리가 쓰는 필드만 표시
type KakaoDocument = {
  id: string;
  place_name: string;
  address_name: string;
  road_address_name: string;
  category_group_name: string;
  x: string; // 경도(longitude)
  y: string; // 위도(latitude)
};

const KAKAO_KEYWORD_URL = 'https://dapi.kakao.com/v2/local/search/keyword.json';

export async function searchPlaces(query: string): Promise<KakaoPlace[]> {
  const keyword = query.trim();
  if (!keyword) return [];

  const apiKey = process.env.EXPO_PUBLIC_KAKAO_REST_API_KEY;
  if (!apiKey) {
    throw new Error('카카오 REST API 키가 없습니다. .env를 확인하세요.');
  }

  const url = `${KAKAO_KEYWORD_URL}?query=${encodeURIComponent(keyword)}&size=15`;
  const res = await fetch(url, {
    headers: { Authorization: `KakaoAK ${apiKey}` },
  });

  if (!res.ok) {
    throw new Error(`카카오 검색 실패 (${res.status})`);
  }

  const data: { documents: KakaoDocument[] } = await res.json();
  return data.documents.map((d) => ({
    id: d.id,
    name: d.place_name,
    address: d.road_address_name || d.address_name,
    latitude: Number(d.y),
    longitude: Number(d.x),
    category: d.category_group_name,
  }));
}
