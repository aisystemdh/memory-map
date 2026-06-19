import { supabase } from './supabase';
import { getCurrentUserId } from './currentUser';
import {
  addImportedPlaces,
  fetchMyPlacesBrief,
  updatePlaceSource,
  ImportedPlaceInput,
  Place,
  PlaceBrief,
} from './places';
import { RouteStatus } from './routes';

// 저장된 루트의 종류 — 가본 동선을 굳혔으면 'visited', 가볼 동선이면 'want'.
export type RouteKind = RouteStatus; // 'visited' | 'want'

// 루트 한 건 (목록·뷰어 표시용). owner_nickname은 친구 루트일 때만 채운다.
export type SharedRoute = {
  id: string;
  owner_id: string;
  title: string;
  description: string | null;
  kind: RouteKind;
  import_count: number; // 몇 명이 가져갔는지
  created_at: string;
  item_count: number; // route_items 개수 ("N곳")
  owner_nickname: string | null; // 친구 루트면 원작자 닉네임, 내 루트면 null
};

// 루트에 담긴 장소 한 곳 (좌표 복제본). 원본 places id는 참조하지 않는다.
export type RouteItem = {
  id: string;
  route_id: string;
  name: string;
  latitude: number;
  longitude: number;
  address: string | null;
  kakao_place_id: string | null;
  order_index: number;
};

// 내가 친구에게서 받아 담아둔 루트(가져온 루트). 아직 내 지도엔 안 풀린 상태일 수 있다.
export type RouteImport = {
  id: string;
  route_id: string;
  title: string; // 받을 때의 제목 스냅샷
  source_name: string; // 원작자 닉네임 스냅샷
  created_at: string;
  unpacked: boolean; // '내 지도에 추가'로 이미 풀었는지
  kind: RouteKind | null; // 원본 루트 종류(가본/가볼). 조회 불가면 null
  total: number; // 이 루트로 내 지도에 만들어진 가볼 곳 수
  visited: number; // 그중 다녀온(체크인) 수
  completed: boolean; // 완주 여부 (total>0 && visited===total)
};

// 루트에 복제해 넣을 장소의 최소 정보 (만들 때 넘김)
export type RouteItemInput = {
  name: string;
  latitude: number;
  longitude: number;
  address: string | null;
  kakao_place_id: string | null;
};

// 1) 루트 만들기 = 공유가 곧 저장.
//    routes(owner=나, share_scope='friends' 고정) + route_items(좌표 복제, order_index 순)를 생성한다.
//    public은 이번 UI에서 만들지 않는다(친구 공유만).
export async function createRoute(
  title: string,
  description: string | null,
  kind: RouteKind,
  items: RouteItemInput[]
): Promise<string> {
  const userId = await getCurrentUserId();
  const { data: route, error } = await supabase
    .from('routes')
    .insert({
      owner_id: userId,
      title: title.trim(),
      description: description?.trim() || null,
      share_scope: 'friends',
      kind,
    })
    .select('id')
    .single();
  if (error) throw error;
  const routeId = route.id as string;

  if (items.length > 0) {
    const rows = items.map((it, i) => ({
      route_id: routeId,
      name: it.name,
      latitude: it.latitude,
      longitude: it.longitude,
      address: it.address ?? null,
      kakao_place_id: it.kakao_place_id ?? null,
      order_index: i,
    }));
    const { error: itemErr } = await supabase.from('route_items').insert(rows);
    if (itemErr) throw itemErr;
  }
  return routeId;
}

// 2-1) 내가 만든 루트 목록 (최신순). 장소수는 중첩 count로 받는다. 호출부가 kind로 가본/가볼 분리.
export async function fetchMyRoutes(): Promise<SharedRoute[]> {
  const userId = await getCurrentUserId();
  const { data, error } = await supabase
    .from('routes')
    .select('id, owner_id, title, description, kind, import_count, created_at, route_items(count)')
    .eq('owner_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r: any) => ({
    id: r.id,
    owner_id: r.owner_id,
    title: r.title,
    description: r.description,
    kind: r.kind,
    import_count: r.import_count ?? 0,
    created_at: r.created_at,
    item_count: r.route_items?.[0]?.count ?? 0,
    owner_nickname: null,
  }));
}

// 2-2) 친구가 공유한 루트 목록. RLS(select_visible)가 친구 공개분만 통과시킨다.
//      내 것은 빼고(owner_id != 나), 원작자 닉네임을 함께 가져온다.
export async function fetchFriendRoutes(): Promise<SharedRoute[]> {
  const userId = await getCurrentUserId();
  const { data, error } = await supabase
    .from('routes')
    .select(
      'id, owner_id, title, description, kind, import_count, created_at, route_items(count), owner:profiles!owner_id(nickname)'
    )
    .neq('owner_id', userId)
    .eq('share_scope', 'friends')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r: any) => ({
    id: r.id,
    owner_id: r.owner_id,
    title: r.title,
    description: r.description,
    kind: r.kind,
    import_count: r.import_count ?? 0,
    created_at: r.created_at,
    item_count: r.route_items?.[0]?.count ?? 0,
    owner_nickname: (r.owner?.nickname as string) || '사용자',
  }));
}

// 루트에 담긴 장소들 (order_index 순) — 뷰어·풀기에 쓴다. RLS가 접근을 방어한다.
export async function fetchRouteItems(routeId: string): Promise<RouteItem[]> {
  const { data, error } = await supabase
    .from('route_items')
    .select('id, route_id, name, latitude, longitude, address, kakao_place_id, order_index')
    .eq('route_id', routeId)
    .order('order_index', { ascending: true });
  if (error) throw error;
  return (data ?? []) as RouteItem[];
}

// 내 루트 삭제 (route_items는 FK ON DELETE CASCADE로 함께 정리). RLS가 본인 것만 허용.
export async function deleteRoute(routeId: string): Promise<void> {
  const userId = await getCurrentUserId();
  const { error } = await supabase.from('routes').delete().eq('id', routeId).eq('owner_id', userId);
  if (error) throw error;
}

// 3-1) 담기: 친구 루트를 내 '가져온 루트'에 담는다(아직 내 지도엔 안 만듦).
//      title·source_name은 그 순간의 스냅샷. 원본 루트의 가져간 횟수는 DB 함수로 +1.
//      이미 담은 루트면 막는다(중복 카드·중복 카운트 방지).
export async function importRoute(
  routeId: string,
  title: string,
  sourceName: string
): Promise<void> {
  const userId = await getCurrentUserId();
  // 이미 담았는지 확인
  const { data: existing, error: exErr } = await supabase
    .from('route_imports')
    .select('id')
    .eq('user_id', userId)
    .eq('route_id', routeId)
    .limit(1);
  if (exErr) throw exErr;
  if (existing && existing.length > 0) {
    throw new Error('이미 가져온 루트예요.');
  }
  const { error } = await supabase
    .from('route_imports')
    .insert({ route_id: routeId, user_id: userId, title, source_name: sourceName });
  if (error) throw error;
  // 원본 루트의 import_count +1 (인자명은 실DB 확인 결과 'route')
  const { error: rpcErr } = await supabase.rpc('increment_route_import', { route: routeId });
  if (rpcErr) throw rpcErr;
}

// 3-2) 내 '가져온 루트' 목록 + 풀림 여부/원본 종류/완주 진행도.
export async function fetchMyImports(): Promise<RouteImport[]> {
  const userId = await getCurrentUserId();
  const [imports, brief] = await Promise.all([
    supabase
      .from('route_imports')
      .select('id, route_id, title, source_name, created_at, route:routes(kind)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false }),
    fetchMyPlacesBrief(),
  ]);
  if (imports.error) throw imports.error;
  return (imports.data ?? []).map((r: any) => {
    // 이 import로 내 지도에 만들어진 가볼 곳들(완주 진행도 계산)
    const belonging = brief.filter((p) => p.imported_from === r.id);
    const total = belonging.length;
    const visited = belonging.filter((p) => p.status === 'visited').length;
    return {
      id: r.id,
      route_id: r.route_id,
      title: r.title,
      source_name: r.source_name,
      created_at: r.created_at,
      unpacked: total > 0,
      kind: (r.route?.kind as RouteKind) ?? null,
      total,
      visited,
      completed: total > 0 && visited === total,
    };
  });
}

// 출처(source) 누적 — 이미 있으면 그대로, 없으면 " | "로 이어 붙인다.
async function mergeSource(p: PlaceBrief, source: string): Promise<void> {
  const current = p.source ?? '';
  if (current.includes(source)) return;
  await updatePlaceSource(p.id, current ? `${current} | ${source}` : source);
}

// 3-3) 풀기: 가져온 루트의 route_items를 내 places에 '가볼 곳(want)'으로 복제.
//   중복 방지(STEP 6): 같은 kakao_place_id가 이미 내 지도에 있으면 새 핀을 만들지 않고
//   기존 핀에 출처만 누적(머지)한다. 이미 다녀온 곳도 가볼 곳으로 다시 만들지 않는다.
//   이미 푼 import면 아무것도 안 한다. 반환: { added(새로 만든 가볼 곳), merged(머지된 수) }.
export async function unpackImport(imp: RouteImport): Promise<{ added: Place[]; merged: number }> {
  const brief = await fetchMyPlacesBrief();
  if (brief.some((p) => p.imported_from === imp.id)) return { added: [], merged: 0 }; // 이미 추가됨
  const items = await fetchRouteItems(imp.route_id);
  if (items.length === 0) return { added: [], merged: 0 };
  const source = `${imp.source_name}: ${imp.title}`;

  // kakao_place_id로 기존 장소 색인
  const byKakao = new Map<string, PlaceBrief>();
  for (const p of brief) if (p.kakao_place_id) byKakao.set(p.kakao_place_id, p);

  const toCreate: ImportedPlaceInput[] = [];
  let merged = 0;
  for (const it of items) {
    const existing = it.kakao_place_id ? byKakao.get(it.kakao_place_id) : undefined;
    if (existing) {
      // 이미 있는 장소(가본/가볼 무관) → 중복 핀 대신 출처만 누적
      await mergeSource(existing, source);
      merged++;
    } else {
      toCreate.push({
        name: it.name,
        latitude: it.latitude,
        longitude: it.longitude,
        address: it.address,
        kakao_place_id: it.kakao_place_id,
      });
    }
  }
  const added = await addImportedPlaces(toCreate, imp.id, source);
  return { added, merged };
}

// BUG 2-B: 내 지도의 '가져온 루트' 장소들을 원래 순서(order_index)대로 잇기 위한 순서 복원.
// 스키마 변경 없이, place.imported_from → route_imports.route_id → route_items(order_index)를
// kakao_place_id로 매칭해 { placeId: order_index } 맵을 만든다.
export async function fetchImportedOrders(): Promise<Record<string, number>> {
  const userId = await getCurrentUserId();
  // 1) 내 가져온 장소들 (imported_from 있는 것)
  const { data: myPlaces, error: e1 } = await supabase
    .from('places')
    .select('id, imported_from, kakao_place_id')
    .eq('user_id', userId)
    .not('imported_from', 'is', null);
  if (e1) throw e1;
  const rows = (myPlaces ?? []) as {
    id: string;
    imported_from: string;
    kakao_place_id: string | null;
  }[];
  if (rows.length === 0) return {};

  // 2) import → route_id
  const importIds = Array.from(new Set(rows.map((r) => r.imported_from)));
  const { data: imps, error: e2 } = await supabase
    .from('route_imports')
    .select('id, route_id')
    .in('id', importIds);
  if (e2) throw e2;
  const routeByImport = new Map((imps ?? []).map((i: any) => [i.id as string, i.route_id as string]));

  // 3) route_items의 (route_id, kakao_place_id) → order_index
  const routeIds = Array.from(new Set((imps ?? []).map((i: any) => i.route_id as string)));
  if (routeIds.length === 0) return {};
  const { data: items, error: e3 } = await supabase
    .from('route_items')
    .select('route_id, kakao_place_id, order_index')
    .in('route_id', routeIds);
  if (e3) throw e3;
  const orderByKey = new Map<string, number>();
  for (const it of (items ?? []) as any[]) {
    if (it.kakao_place_id) orderByKey.set(`${it.route_id}|${it.kakao_place_id}`, it.order_index);
  }

  // 4) 내 각 장소에 order_index 부여
  const result: Record<string, number> = {};
  for (const r of rows) {
    const routeId = routeByImport.get(r.imported_from);
    if (routeId && r.kakao_place_id) {
      const ord = orderByKey.get(`${routeId}|${r.kakao_place_id}`);
      if (ord !== undefined) result[r.id] = ord;
    }
  }
  return result;
}

// STEP 4 자동 루트: 같은 날 추가 체크인을 기존 루트에 이어 붙인다(다음 order_index로).
export async function appendRouteItem(routeId: string, item: RouteItemInput): Promise<void> {
  const { data, error } = await supabase
    .from('route_items')
    .select('order_index')
    .eq('route_id', routeId)
    .order('order_index', { ascending: false })
    .limit(1);
  if (error) throw error;
  const nextIndex = ((data?.[0]?.order_index as number) ?? -1) + 1;
  const { error: insErr } = await supabase.from('route_items').insert({
    route_id: routeId,
    name: item.name,
    latitude: item.latitude,
    longitude: item.longitude,
    address: item.address ?? null,
    kakao_place_id: item.kakao_place_id ?? null,
    order_index: nextIndex,
  });
  if (insErr) throw insErr;
}
