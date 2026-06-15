import { Place } from './places';
import { Visit } from './visits';

// 루트(동선)를 그릴 수 있는 상태. 가본 곳=visits.visited_on, 가볼 곳=places.plan_date 기준.
export type RouteStatus = 'visited' | 'want';

// 루트에 쓸 날짜들 (중복 제거) — 달력에 점으로 활성화할 날짜 목록.
// 가본: 방문(visit)들의 날짜. 가볼: want 장소들의 계획일.
export function routeDates(
  places: Place[],
  visits: Visit[],
  routeStatus: RouteStatus
): string[] {
  if (routeStatus === 'visited') {
    return Array.from(new Set(visits.map((v) => v.visited_on)));
  }
  return Array.from(
    new Set(
      places
        .filter((p) => p.status === 'want' && p.plan_date)
        .map((p) => p.plan_date as string)
    )
  );
}

// 그 날짜의 루트 장소들 — 동선(Polyline)·지도 이동용.
// 가본: "그 날 방문(visit)들"을 시간순으로 → 각 방문의 place. (동선 단위가 place가 아니라 visit이다.
//        같은 장소를 다른 날 갔으면 각 날짜 루트에 각각 들어간다)
// 가볼: 그 계획일을 가진 want 장소들.
export function routePlacesOn(
  places: Place[],
  visits: Visit[],
  routeStatus: RouteStatus,
  date: string
): Place[] {
  if (routeStatus === 'visited') {
    const placeById = new Map(places.map((p) => [p.id, p]));
    return visits
      .filter((v) => v.visited_on === date)
      .slice()
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .map((v) => placeById.get(v.place_id))
      .filter((p): p is Place => p !== undefined);
  }
  return places
    .filter((p) => p.status === 'want' && p.plan_date === date)
    .slice()
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
}
