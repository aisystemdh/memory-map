// 카카오 로컬 검색 결과 한 건의 형태 (키워드 검색·주변 검색 공용)
export type KakaoPlace = {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  category: string;
  phone: string; // 없으면 빈 문자열
};

// 카카오 API 원본 응답 중 우리가 쓰는 필드만 표시
type KakaoDocument = {
  id: string;
  place_name: string;
  address_name: string;
  road_address_name: string;
  category_group_name: string;
  phone: string;
  x: string; // 경도(longitude)
  y: string; // 위도(latitude)
};

const KAKAO_KEYWORD_URL = 'https://dapi.kakao.com/v2/local/search/keyword.json';
const KAKAO_CATEGORY_URL = 'https://dapi.kakao.com/v2/local/search/category.json';

// 주변 자동 표시에 쓰는 카테고리 그룹. 무료 일일 한도 보호를 위해 2개만 호출한다.
const NEARBY_GROUPS = ['FD6', 'CE7']; // 음식점, 카페

function getApiKey(): string {
  const apiKey = process.env.EXPO_PUBLIC_KAKAO_REST_API_KEY;
  if (!apiKey) {
    throw new Error('카카오 REST API 키가 없습니다. .env를 확인하세요.');
  }
  return apiKey;
}

function toPlace(d: KakaoDocument): KakaoPlace {
  return {
    id: d.id,
    name: d.place_name,
    address: d.road_address_name || d.address_name,
    latitude: Number(d.y),
    longitude: Number(d.x),
    category: d.category_group_name,
    phone: d.phone || '',
  };
}

export async function searchPlaces(query: string): Promise<KakaoPlace[]> {
  const keyword = query.trim();
  if (!keyword) return [];

  const url = `${KAKAO_KEYWORD_URL}?query=${encodeURIComponent(keyword)}&size=15`;
  const res = await fetch(url, {
    headers: { Authorization: `KakaoAK ${getApiKey()}` },
  });

  if (!res.ok) {
    throw new Error(`카카오 검색 실패 (${res.status})`);
  }

  const data: { documents: KakaoDocument[] } = await res.json();
  return data.documents.map(toPlace);
}

// 좌표 주변의 장소를 카테고리 그룹으로 검색 (가까운 순).
// 카카오는 x=경도, y=위도 순서에 주의. radius 단위는 미터(최대 20000).
export async function searchNearbyPlaces(
  latitude: number,
  longitude: number,
  radius: number
): Promise<KakaoPlace[]> {
  const apiKey = getApiKey();

  const groupResults = await Promise.all(
    NEARBY_GROUPS.map(async (group) => {
      const url =
        `${KAKAO_CATEGORY_URL}?category_group_code=${group}` +
        `&x=${longitude}&y=${latitude}&radius=${Math.round(radius)}&sort=distance&size=10`;
      const res = await fetch(url, {
        headers: { Authorization: `KakaoAK ${apiKey}` },
      });
      if (!res.ok) {
        throw new Error(`카카오 주변 검색 실패 (${res.status})`);
      }
      const data: { documents: KakaoDocument[] } = await res.json();
      return data.documents.map(toPlace);
    })
  );

  // 그룹 간 같은 장소가 겹칠 수 있어 id로 중복 제거
  const seen = new Set<string>();
  return groupResults.flat().filter((p) => {
    if (seen.has(p.id)) return false;
    seen.add(p.id);
    return true;
  });
}
