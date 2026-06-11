import { Place } from './places';

// 루트(동선)를 그릴 수 있는 상태. 가본 곳=visited_on, 가볼 곳=plan_date 기준.
export type RouteStatus = 'visited' | 'want';

// 이 장소가 루트에서 쓰는 날짜. 상태가 다르거나 날짜가 비면 null(루트 제외).
export function routeDate(place: Place, routeStatus: RouteStatus): string | null {
  if (place.status !== routeStatus) return null;
  return routeStatus === 'visited' ? place.visited_on : place.plan_date;
}

// 루트가 있는 날짜들 (중복 제거) — 달력에 점으로 활성화할 날짜 목록
export function routeDates(places: Place[], routeStatus: RouteStatus): string[] {
  return Array.from(
    new Set(
      places
        .map((p) => routeDate(p, routeStatus))
        .filter((d): d is string => d !== null)
    )
  );
}

// 그날의 루트 장소들을 시간순(저장한 순서)으로 — Polyline·지도 이동용
export function routePlacesOn(
  places: Place[],
  routeStatus: RouteStatus,
  date: string
): Place[] {
  return places
    .filter((p) => routeDate(p, routeStatus) === date)
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
}
