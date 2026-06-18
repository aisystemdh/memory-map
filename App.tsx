import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import MapView, { Marker, Polyline, Region } from 'react-native-maps';
import CalendarModal from './components/CalendarModal';
import CategoryModal from './components/CategoryModal';
import PlaceCard from './components/PlaceCard';
import PlaceDetailCard from './components/PlaceDetailCard';
import PlaceMarker from './components/PlaceMarker';
import SavePlaceModal from './components/SavePlaceModal';
import SearchBar from './components/SearchBar';
import VisitInputModal from './components/VisitInputModal';
import FriendsScreen from './screens/FriendsScreen';
import FriendPlaceCard from './components/FriendPlaceCard';
import { PickedFriendPlace } from './screens/FriendPlacesPanel';
import RoutesScreen, { ViewerPayload } from './screens/RoutesScreen';
import ShareRouteModal from './components/ShareRouteModal';
import RouteViewerBar from './components/RouteViewerBar';
import AutoRouteModal from './components/AutoRouteModal';
import {
  appendRouteItem,
  createRoute,
  fetchImportedOrders,
  importRoute,
  RouteKind,
} from './lib/sharedRoutes';
import { KakaoPlace } from './lib/kakao';
import {
  addPlace,
  markPlaceVisited,
  fetchPlaces,
  todayString,
  updatePlaceCategory,
  updatePlaceVisibility,
  Place,
  PlaceStatus,
  PlaceVisibility,
} from './lib/places';
import { addVisit, fetchAllVisits, Visit } from './lib/visits';
import { uploadPhotos, PickedPhoto } from './lib/photos';
import { routeDates, routePlacesOn, RouteStatus } from './lib/routes';
import { useCurrentLocation } from './hooks/useCurrentLocation';
import { useCategories } from './hooks/useCategories';

// 보기 상태 — 최상위에서 [루트로 보기] / [카테고리로 보기]로 갈린다.
// 루트: 가본(visits.visited_on) 또는 가볼(plan_date) 날짜별 동선. 카테고리: 전체 핀 + 분류 필터.
type ViewState =
  | { mode: 'category'; filterCategoryId: string | null } // null = 전체 보기
  | { mode: 'route'; routeStatus: RouteStatus; selectedDate: string | null };

// 앱 시작 화면은 대한민국 전국이 보이게(중심 대략 위도 36.5, 경도 127.8).
// 사용자가 해외로 움직이는 것은 막지 않는다(해외 장소 기록 가능).
const INITIAL_REGION: Region = {
  latitude: 36.5,
  longitude: 127.8,
  latitudeDelta: 5.0,
  longitudeDelta: 5.0,
};

export default function App() {
  const mapRef = useRef<MapView>(null);
  // Supabase에 저장된 핀(장소 정체성)들
  const [places, setPlaces] = useState<Place[]>([]);
  // 내 모든 방문(visit) — 동선·달력·카드 슬라이드가 여기서 파생된다
  const [visits, setVisits] = useState<Visit[]>([]);
  // 저장 모달에 띄울, 아직 저장 전인 장소 (미리보기 핀 포함)
  const [pending, setPending] = useState<KakaoPlace | null>(null);
  // 상세 카드에서 '찜/기록' 중 무엇으로 들어왔는지 — 저장 모달의 기본 상태
  const [pendingStatus, setPendingStatus] = useState<PlaceStatus>('visited');
  const [saving, setSaving] = useState(false);
  // 검색 결과를 탭했을 때 보여줄 장소 상세 카드 (저장 전 장소의 진입점)
  const [detailPlace, setDetailPlace] = useState<KakaoPlace | null>(null);
  // 방문 추가/체크인 입력 시트의 대상 장소 (null이면 닫힘)
  const [visitTarget, setVisitTarget] = useState<Place | null>(null);
  const [savingVisit, setSavingVisit] = useState(false);
  // 보기 상태 (기본: 루트로 보기 > 가본 곳, 날짜는 방문 로딩 후 최근 방문일로)
  const [view, setView] = useState<ViewState>({
    mode: 'route',
    routeStatus: 'visited',
    selectedDate: null,
  });
  // 달력 열림 여부
  const [calendarVisible, setCalendarVisible] = useState(false);
  // 핀을 눌렀을 때 보여줄 장소 카드
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);
  // 현재 위치 + 위치 권한 상태 (별도 훅으로 분리)
  const { location, status, refreshLocation } = useCurrentLocation();
  // 카테고리 목록 + 추가/삭제
  const { categories, add: addCategoryItem, remove: removeCategoryItem } = useCategories();
  // 카테고리 관리 모달 열림 여부
  const [categoryModalVisible, setCategoryModalVisible] = useState(false);
  // [카테고리로 보기] 진입 시 "카테고리 고르기" 시트 열림 여부
  const [categoryPickerVisible, setCategoryPickerVisible] = useState(false);
  // 친구 화면(관리+친구장소 탭) 열림 여부
  const [friendsVisible, setFriendsVisible] = useState(false);
  // 지도에서 보여줄 친구의 공개 장소 (읽기 전용 카드). 내 places 상태와 별개 — 오염 방지.
  const [friendCardPlace, setFriendCardPlace] = useState<PickedFriendPlace | null>(null);
  // 루트 화면(내/친구/가져온) 열림 여부
  const [routesVisible, setRoutesVisible] = useState(false);
  // "이 루트 공유" 모달 열림 + 저장 중 여부
  const [shareVisible, setShareVisible] = useState(false);
  const [sharing, setSharing] = useState(false);
  // 루트 뷰어 — 모든 루트 보기를 한 군데로 통일한 상태(내 places와 분리, 섞지 않음).
  //   source 'date'  = 날짜로 묶은 동선(가본=visited_on / 가볼=plan_date 순)
  //   source 'saved' = 저장된 루트 또는 친구에게서 가져온 루트(route_items의 order_index 순)
  // 어느 경우든 같은 이전/다음 + animateToRegion + 점선/실선 로직을 탄다.
  const [routeViewer, setRouteViewer] = useState<{
    source: 'date' | 'saved';
    points: { id: string; name: string; latitude: number; longitude: number }[];
    kind: RouteKind; // visited=실선 / want=점선
    title: string;
    index: number;
    friendRoute: { id: string; sourceName: string } | null;
  } | null>(null);
  // 친구 루트를 이 뷰어에서 이미 담았는지 (가져오기 1단계)
  const [viewerImported, setViewerImported] = useState(false);
  // STEP 4 자동 루트 — 같은 날 2번째 체크인 감지 시 "루트로 남길까요?" 제안 모달.
  const [autoRoutePrompt, setAutoRoutePrompt] = useState<{ date: string; placeCount: number } | null>(
    null
  );
  const [autoRouteSaving, setAutoRouteSaving] = useState(false);
  // 날짜별 자동 루트 기록 — routeId(생성됨)·declined(그날 거부)·placeIds(이미 넣은 장소).
  // 같은 날 반복 팝업을 막고, 생성 후엔 추가 체크인을 자동으로 이어 붙인다(이 세션 동안).
  const autoRouteByDate = useRef<
    Map<string, { routeId: string | null; declined: boolean; placeIds: Set<string> }>
  >(new Map());
  // BUG 2-B: 가져온 루트 핀들의 원래 순서 { placeId: order_index } — 지도에서 점선 연결·번호 표시용.
  const [importedOrders, setImportedOrders] = useState<Record<string, number>>({});

  // 핀 색 결정용: 카테고리 id → 색
  const categoryColorById = useMemo(
    () => new Map(categories.map((c) => [c.id, c.color])),
    [categories]
  );

  // 앱 시작 시 장소 + 방문을 함께 불러오기
  useEffect(() => {
    Promise.all([fetchPlaces(), fetchAllVisits()])
      .then(([placeRows, visitRows]) => {
        setPlaces(placeRows);
        setVisits(visitRows);
        // 가장 최근 방문일을 기본 선택해서 동선이 바로 보이게 (visits는 최근순 정렬)
        if (visitRows.length > 0) {
          setView({ mode: 'route', routeStatus: 'visited', selectedDate: visitRows[0].visited_on });
        }
      })
      .catch((e) =>
        Alert.alert('불러오기 실패', e instanceof Error ? e.message : '오류가 발생했습니다.')
      );
  }, []);

  // 달력에 활성화할 날짜들 — 가본=방문일, 가볼=계획일 (루트 모드에서만 의미 있음)
  const calendarDates = useMemo(
    () => (view.mode === 'route' ? routeDates(places, visits, view.routeStatus) : []),
    [places, visits, view]
  );

  // 선택된 날짜의 루트 장소들 (시간순) → "이 루트 공유하기" 버튼/모달용.
  // 실제 동선 그리기는 통일된 routeViewer가 맡는다.
  const selectedRoutePlaces = useMemo(() => {
    if (view.mode !== 'route' || !view.selectedDate) return [];
    return routePlacesOn(places, visits, view.routeStatus, view.selectedDate);
  }, [places, visits, view]);

  // BUG 2-B: 가져온 루트 핀의 순서를 서버에서 복원(가져온 장소 집합이 바뀔 때마다 갱신).
  const importedSig = useMemo(
    () =>
      places
        .filter((p) => p.imported_from)
        .map((p) => p.id)
        .sort()
        .join(','),
    [places]
  );
  useEffect(() => {
    if (!importedSig) {
      setImportedOrders({});
      return;
    }
    let active = true;
    fetchImportedOrders()
      .then((m) => {
        if (active) setImportedOrders(m);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [importedSig]);

  // 같은 가져온 루트(imported_from)끼리 묶어 order 순 정렬 — 지도에서 점선으로 잇는다(2곳 이상만).
  const importedRoutes = useMemo(() => {
    const groups = new Map<string, Place[]>();
    for (const p of places) {
      if (!p.imported_from) continue;
      const arr = groups.get(p.imported_from) ?? [];
      arr.push(p);
      groups.set(p.imported_from, arr);
    }
    const out: { id: string; places: Place[] }[] = [];
    groups.forEach((arr, id) => {
      if (arr.length < 2) return;
      const sorted = arr
        .slice()
        .sort((a, b) => (importedOrders[a.id] ?? 9999) - (importedOrders[b.id] ?? 9999));
      out.push({ id, places: sorted });
    });
    return out;
  }, [places, importedOrders]);

  // placeId → { 순번(1부터), 시작점 여부 } — 핀 번호·깃발 표시용.
  const importedPinInfo = useMemo(() => {
    const m = new Map<string, { order: number; isStart: boolean }>();
    importedRoutes.forEach((grp) => {
      grp.places.forEach((p, i) => m.set(p.id, { order: i + 1, isStart: i === 0 }));
    });
    return m;
  }, [importedRoutes]);

  // 선택된 장소의 방문들 (최근 먼저) — 카드 슬라이드용
  const selectedPlaceVisits = useMemo(() => {
    if (!selectedPlace) return [];
    return visits
      .filter((v) => v.place_id === selectedPlace.id)
      .slice()
      .sort(
        (a, b) =>
          b.visited_on.localeCompare(a.visited_on) || b.created_at.localeCompare(a.created_at)
      );
  }, [visits, selectedPlace]);

  // 검색 결과를 선택하면 지도 이동 + 상세 카드 열기 (저장 모달은 카드의 찜/기록 버튼에서)
  function handleSelect(place: KakaoPlace) {
    setDetailPlace(place);
    setSelectedPlace(null);
    setFriendCardPlace(null);
    mapRef.current?.animateToRegion({
      latitude: place.latitude,
      longitude: place.longitude,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    });
  }

  // 상세 카드에서 찜(want)/기록(visited)을 고르면 저장 모달을 연다.
  // 단, 같은 kakao_place_id를 이미 저장했으면 새 장소 대신 "방문 추가"를 제안한다.
  function handleSaveAs(place: KakaoPlace, nextStatus: PlaceStatus) {
    const existing = place.id
      ? places.find((p) => p.kakao_place_id && p.kakao_place_id === place.id)
      : undefined;
    if (existing) {
      setDetailPlace(null);
      // ★3: 이미 '가보고 싶다(want/imported)'로 저장한 곳이면 새로 만들지 않고 다녀온 곳으로 승격 제안.
      const isWant = existing.status !== 'visited';
      const alertTitle = isWant ? '가보고 싶다고 저장한 곳이에요' : '이미 다녀온 곳이에요';
      const alertMsg = isWant ? '다녀온 곳으로 옮길까요?' : '이 장소에 방문을 추가할까요?';
      const actionText = isWant ? '다녀온 곳으로' : '방문 추가';
      Alert.alert(alertTitle, alertMsg, [
        { text: '취소', style: 'cancel' },
        {
          text: actionText,
          onPress: () => {
            // 방문 입력 후 handleSubmitVisit이 같은 place를 visited로 승격(새 핀 안 만듦).
            setSelectedPlace(existing);
            setVisitTarget(existing);
            mapRef.current?.animateToRegion({
              latitude: existing.latitude,
              longitude: existing.longitude,
              latitudeDelta: 0.01,
              longitudeDelta: 0.01,
            });
          },
        },
      ]);
      return;
    }
    setPendingStatus(nextStatus);
    setPending(place);
    setDetailPlace(null);
  }

  // 달력에서 날짜를 고르면: 그날 동선을 통일된 뷰어로 연다(가본=실선/가볼=점선, 이전·다음 이동).
  function handleSelectDate(date: string) {
    if (view.mode !== 'route') return;
    setView({ ...view, selectedDate: date });
    const dayPlaces = routePlacesOn(places, visits, view.routeStatus, date);
    if (dayPlaces.length === 0) {
      setCalendarVisible(false);
      return;
    }
    const label = view.routeStatus === 'visited' ? '다녀온 동선' : '가볼 동선';
    openRouteViewer(
      'date',
      dayPlaces.map((p) => ({
        id: p.id,
        name: p.name,
        latitude: p.latitude,
        longitude: p.longitude,
      })),
      view.routeStatus,
      `${date} ${label}`,
      null
    );
  }

  // "내 위치" 버튼: 현재 위치로 지도를 부드럽게 이동
  async function handleRecenter() {
    const coords = location ?? (await refreshLocation());
    if (!coords) {
      Alert.alert('현재 위치', '현재 위치를 가져오지 못했습니다. 잠시 후 다시 시도해 주세요.');
      return;
    }
    mapRef.current?.animateToRegion({
      latitude: coords.latitude,
      longitude: coords.longitude,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    });
  }

  // 카드에서 분류 변경: DB 갱신 후 화면 상태도 맞춰준다.
  async function handleChangeCategory(placeId: string, categoryId: string | null) {
    try {
      await updatePlaceCategory(placeId, categoryId);
      setPlaces((prev) =>
        prev.map((p) => (p.id === placeId ? { ...p, category_id: categoryId } : p))
      );
      setSelectedPlace((prev) =>
        prev && prev.id === placeId ? { ...prev, category_id: categoryId } : prev
      );
    } catch (e) {
      Alert.alert('분류 변경 실패', e instanceof Error ? e.message : '오류가 발생했습니다.');
    }
  }

  // 카드에서 공개범위 변경(나만 보기 ↔ 친구에게 공개): DB 갱신 후 화면 상태도 맞춰준다.
  // friends일 때는 친구 한마디(friendNote)도 함께 저장한다.
  async function handleChangeVisibility(
    placeId: string,
    visibility: PlaceVisibility,
    friendNote?: string | null
  ) {
    try {
      const note = friendNote === undefined ? undefined : friendNote?.trim() || null;
      await updatePlaceVisibility(placeId, visibility, note);
      const apply = (p: Place): Place => ({
        ...p,
        visibility,
        friend_note: note === undefined ? p.friend_note : note,
      });
      setPlaces((prev) => prev.map((p) => (p.id === placeId ? apply(p) : p)));
      setSelectedPlace((prev) => (prev && prev.id === placeId ? apply(prev) : prev));
    } catch (e) {
      Alert.alert('공개범위 변경 실패', e instanceof Error ? e.message : '오류가 발생했습니다.');
    }
  }

  // 카테고리 삭제: DB가 장소의 분류를 자동 해제(SET NULL)하므로 화면 상태도 맞춰준다.
  async function handleRemoveCategory(id: string) {
    const ok = await removeCategoryItem(id);
    if (!ok) return;
    setPlaces((prev) => prev.map((p) => (p.category_id === id ? { ...p, category_id: null } : p)));
    setSelectedPlace((prev) =>
      prev && prev.category_id === id ? { ...prev, category_id: null } : prev
    );
    // 지운 카테고리로 필터 중이었다면 전체 보기로
    setView((v) =>
      v.mode === 'category' && v.filterCategoryId === id ? { ...v, filterCategoryId: null } : v
    );
  }

  // 카드에서 "방문 추가"/"체크인"을 누르면 방문 입력 시트를 연다
  function handleRequestAddVisit(place: Place) {
    setVisitTarget(place);
  }

  // 친구 장소 이름을 누르면: 친구 화면을 닫고 그 위치로 지도 이동 + 읽기전용 친구 카드.
  // 친구 장소는 내 places/visits 상태에 넣지 않는다(임시 표시만).
  function handlePickFriendPlace(picked: PickedFriendPlace) {
    setFriendsVisible(false);
    setSelectedPlace(null);
    setDetailPlace(null);
    setFriendCardPlace(picked);
    mapRef.current?.animateToRegion({
      latitude: picked.place.latitude,
      longitude: picked.place.longitude,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    });
  }

  // "이 루트 공유" — 지금 보고 있는 날짜 동선이 2곳 이상일 때만 공유 모달을 연다.
  function handleOpenShare() {
    if (view.mode !== 'route' || !view.selectedDate || selectedRoutePlaces.length < 2) return;
    setShareVisible(true);
  }

  // FIX 1: 루트에 'private'(나만 보기) 장소가 있으면 생성 전에 알리고 [그대로 포함]/[빼고 만들기]를 받는다.
  // private이 없으면 알림 없이 바로 doCreate. (모든 루트 생성 경로가 이 검사를 거친다)
  function withPrivateCheck(placesForRoute: Place[], doCreate: (final: Place[]) => void) {
    const privates = placesForRoute.filter((p) => p.visibility === 'private');
    if (privates.length === 0) {
      doCreate(placesForRoute);
      return;
    }
    const names = privates.map((p) => p.name).join(', ');
    Alert.alert(
      '나만 보기 장소 포함',
      `이 루트에 나만 보기 장소(${names})가 포함돼요. 루트를 공유하면 친구에게도 보이게 됩니다.`,
      [
        { text: '취소', style: 'cancel' },
        {
          text: '빼고 만들기',
          onPress: () => doCreate(placesForRoute.filter((p) => p.visibility !== 'private')),
        },
        { text: '그대로 포함', onPress: () => doCreate(placesForRoute) },
      ]
    );
  }

  // 공유 확인 — 그 순간 routes + route_items(좌표 복제) 생성. kind=현재 가본/가볼.
  async function handleShareRoute(title: string, description: string) {
    if (view.mode !== 'route' || !view.selectedDate) return;
    withPrivateCheck(selectedRoutePlaces, async (finalPlaces) => {
      if (finalPlaces.length < 2) {
        Alert.alert('장소 부족', '루트에는 장소가 2곳 이상 필요해요.');
        return;
      }
      const items = finalPlaces.map((p) => ({
        name: p.name,
        latitude: p.latitude,
        longitude: p.longitude,
        address: p.address,
        kakao_place_id: p.kakao_place_id,
      }));
      setSharing(true);
      try {
        await createRoute(title, description || null, view.routeStatus, items);
        setShareVisible(false);
        Alert.alert(
          '공유했어요',
          "[루트] 화면의 '내 루트'에서 볼 수 있어요. 친구는 '친구 루트'에서 가져갈 수 있어요."
        );
      } catch (e) {
        Alert.alert('루트 공유 실패', e instanceof Error ? e.message : '오류가 발생했습니다.');
      } finally {
        setSharing(false);
      }
    });
  }

  // 모든 루트 보기의 단일 진입점. 다른 화면/카드를 닫고, 지도에 그 루트만 임시 표시하며 첫 핀으로 이동.
  function openRouteViewer(
    source: 'date' | 'saved',
    points: { id: string; name: string; latitude: number; longitude: number }[],
    kind: RouteKind,
    title: string,
    friendRoute: { id: string; sourceName: string } | null
  ) {
    if (points.length === 0) return;
    setRoutesVisible(false);
    setCalendarVisible(false);
    setSelectedPlace(null);
    setDetailPlace(null);
    setFriendCardPlace(null);
    setViewerImported(false);
    setRouteViewer({ source, points, kind, title, index: 0, friendRoute });
    const first = points[0];
    mapRef.current?.animateToRegion({
      latitude: first.latitude,
      longitude: first.longitude,
      latitudeDelta: 0.02,
      longitudeDelta: 0.02,
    });
  }

  // 루트 화면(저장/친구/가져온 루트)에서 뷰어 열기 — route_items를 공통 점 배열로 바꿔 같은 뷰어에 태운다.
  function handleOpenViewer(payload: ViewerPayload) {
    openRouteViewer(
      'saved',
      payload.items.map((it) => ({
        id: it.id,
        name: it.name,
        latitude: it.latitude,
        longitude: it.longitude,
      })),
      payload.kind,
      payload.title,
      payload.friendRoute
    );
  }

  // 뷰어 이전/다음 — 핀을 하나 옮기고 지도를 그 핀으로 자동 이동(데이터 종류와 무관하게 동일).
  function handleViewerStep(delta: number) {
    setRouteViewer((v) => {
      if (!v) return v;
      const next = Math.max(0, Math.min(v.points.length - 1, v.index + delta));
      const it = v.points[next];
      if (it) {
        mapRef.current?.animateToRegion({
          latitude: it.latitude,
          longitude: it.longitude,
          latitudeDelta: 0.02,
          longitudeDelta: 0.02,
        });
      }
      return { ...v, index: next };
    });
  }

  // 친구 루트 가져오기 1단계(담기) — route_imports 생성 + 가져간 횟수 +1. 내 지도엔 아직 안 만듦.
  async function handleViewerImport() {
    const v = routeViewer;
    if (!v || !v.friendRoute) return;
    try {
      await importRoute(v.friendRoute.id, v.title, v.friendRoute.sourceName);
      setViewerImported(true);
      Alert.alert('가져왔어요', "[루트] 화면의 '가져온 루트'에서 '내 지도에 추가'를 누르면 내 지도에 담겨요.");
    } catch (e) {
      Alert.alert('가져오기 실패', e instanceof Error ? e.message : '오류가 발생했습니다.');
    }
  }

  // 가져온 루트 풀기 결과(새 가볼 곳들)를 내 지도 상태에 반영 (RoutesScreen이 호출).
  function handlePlacesAddedFromImport(added: Place[]) {
    setPlaces((prev) => [...added, ...prev]);
  }

  // 그날 방문한 장소들을 방문 시각 순(중복 제거)으로 — 자동 루트용.
  function dayPlacesFor(allPlaces: Place[], allVisits: Visit[], date: string): Place[] {
    const byId = new Map(allPlaces.map((p) => [p.id, p]));
    const seen = new Set<string>();
    const out: Place[] = [];
    allVisits
      .filter((v) => v.visited_on === date)
      .slice()
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .forEach((v) => {
        if (seen.has(v.place_id)) return;
        const p = byId.get(v.place_id);
        if (p) {
          seen.add(v.place_id);
          out.push(p);
        }
      });
    return out;
  }

  // STEP 4: 체크인 직후 호출. 같은 날 2번째 장소면 제안, 이미 만든 루트면 자동 이어붙이기.
  // BUG 2-A: 가져온 루트(imported_from)의 장소는 자동 루트 대상에서 제외한다.
  //  - 그 장소 체크인은 이미 want→visited로 승격되며(가져온 루트 진행도 갱신), 새 루트를 만들지 않는다.
  //  - "루트로 남길까요?"는 오직 내가 직접 새로 체크인한 장소(imported_from 없음)들로만 뜬다.
  function runAutoRoute(allPlaces: Place[], allVisits: Visit[], justVisited: Place, date: string) {
    if (justVisited.imported_from) return;
    const dayPlaces = dayPlacesFor(allPlaces, allVisits, date).filter((p) => !p.imported_from);
    const info = autoRouteByDate.current.get(date);
    if (info?.routeId) {
      // 이미 그날 루트가 있으면, 새로 들어온 장소를 자동으로 이어 붙인다(다시 안 물어봄).
      if (!info.placeIds.has(justVisited.id)) {
        info.placeIds.add(justVisited.id);
        appendRouteItem(info.routeId, {
          name: justVisited.name,
          latitude: justVisited.latitude,
          longitude: justVisited.longitude,
          address: justVisited.address,
          kakao_place_id: justVisited.kakao_place_id,
        }).catch(() => {});
      }
    } else if (info?.declined) {
      // 그날은 이미 거부 → 다시 안 물어봄
    } else if (dayPlaces.length >= 2 && !autoRoutePrompt) {
      setAutoRoutePrompt({ date, placeCount: dayPlaces.length });
    }
  }

  // 제안 수락 — 그날 다녀온 곳들로 visited 루트 생성 + 이후 같은 날 체크인은 자동 이어붙이기 등록.
  async function handleAutoRouteConfirm(title: string) {
    const prompt = autoRoutePrompt;
    if (!prompt) return;
    // 가져온 루트의 장소는 제외하고, 내가 직접 다녀온 곳들로만 루트를 만든다.
    const dayPlaces = dayPlacesFor(places, visits, prompt.date).filter((p) => !p.imported_from);
    // FIX 1: 자동생성에서도 private 포함 시 반드시 알린다(모르고 공유되는 일 방지).
    withPrivateCheck(dayPlaces, async (finalPlaces) => {
      if (finalPlaces.length < 2) {
        Alert.alert('장소 부족', '루트로 남길 다녀온 곳이 2곳 이상 필요해요.');
        return;
      }
      setAutoRouteSaving(true);
      try {
        const routeId = await createRoute(
          title,
          null,
          'visited',
          finalPlaces.map((p) => ({
            name: p.name,
            latitude: p.latitude,
            longitude: p.longitude,
            address: p.address,
            kakao_place_id: p.kakao_place_id,
          }))
        );
        autoRouteByDate.current.set(prompt.date, {
          routeId,
          declined: false,
          // 오늘 이미 다녀온 곳들은(빼고 만들기로 제외한 private 포함) 다시 이어붙이지 않게 모두 기록.
          placeIds: new Set(dayPlaces.map((p) => p.id)),
        });
        setAutoRoutePrompt(null);
        Alert.alert('루트 생성', '오늘 동선을 루트로 남겼어요. 오늘 더 체크인하면 자동으로 이어집니다.');
      } catch (e) {
        Alert.alert('루트 생성 실패', e instanceof Error ? e.message : '오류가 발생했습니다.');
      } finally {
        setAutoRouteSaving(false);
      }
    });
  }

  // 제안 거부 — 그날은 다시 묻지 않는다.
  function handleAutoRouteDecline() {
    const prompt = autoRoutePrompt;
    if (!prompt) return;
    autoRouteByDate.current.set(prompt.date, {
      routeId: null,
      declined: true,
      placeIds: new Set(),
    });
    setAutoRoutePrompt(null);
  }

  // 방문 입력 제출 — visits에 추가 + 사진 업로드 + (want였으면) status를 visited로 전환.
  // "방문 추가"와 "체크인"이 같은 경로다(차이는 상태 전환 여부뿐).
  async function handleSubmitVisit(visitedOn: string, memo: string, photos: PickedPhoto[]) {
    if (!visitTarget) return;
    const target = visitTarget;
    setSavingVisit(true);
    try {
      const visit = await addVisit(target.id, visitedOn, memo);
      setVisits((prev) => [visit, ...prev]);

      // 가보고 싶은 곳/가져온 곳이었다면 첫 방문으로 '다녀온 곳' 전환 (source 등은 보존)
      if (target.status !== 'visited') {
        await markPlaceVisited(target.id);
        const toVisited = (p: Place): Place =>
          p.id === target.id ? { ...p, status: 'visited' as const } : p;
        setPlaces((prev) => prev.map(toVisited));
        setSelectedPlace((prev) => (prev && prev.id === target.id ? toVisited(prev) : prev));
      }

      // 사진은 방금 만든 방문(visit_id)에 올린다
      if (photos.length > 0) {
        const { success, total } = await uploadPhotos(
          visit.id,
          photos.map((p) => p.base64)
        );
        if (success < total) {
          Alert.alert('사진 저장', `사진 ${total}장 중 ${success}장 저장됨`);
        }
      }

      // 방금 방문한 날짜를 가본 루트에서 바로 보이게
      setView((v) =>
        v.mode === 'route' && v.routeStatus === 'visited' ? { ...v, selectedDate: visitedOn } : v
      );
      // STEP 4: 같은 날 2번째부터 자동 루트 감지/이어붙이기
      runAutoRoute(places, [visit, ...visits], target, visitedOn);
      setVisitTarget(null);
    } catch (e) {
      Alert.alert('방문 저장 실패', e instanceof Error ? e.message : '오류가 발생했습니다.');
    } finally {
      setSavingVisit(false);
    }
  }

  // 모달에서 저장: 장소(정체성) 생성 → 다녀온 곳이면 첫 방문·사진까지 생성
  async function handleSave(
    nextStatus: PlaceStatus,
    visitedOn: string | null,
    memo: string,
    photos: PickedPhoto[],
    categoryId: string | null,
    planDate: string | null,
    planWith: string | null,
    visibility: PlaceVisibility,
    friendNote: string | null
  ) {
    if (!pending) return;
    setSaving(true);
    try {
      const saved = await addPlace({
        name: pending.name,
        latitude: pending.latitude,
        longitude: pending.longitude,
        status: nextStatus,
        plan_date: planDate,
        plan_with: planWith,
        address: pending.address || null,
        kakao_place_id: pending.id || null,
        category_id: categoryId,
        visibility,
        friend_note: friendNote,
      });
      setPlaces((prev) => [saved, ...prev]);

      if (nextStatus === 'visited') {
        // 첫 방문 1건 생성 + 사진
        const visit = await addVisit(saved.id, visitedOn ?? todayString(), memo);
        setVisits((prev) => [visit, ...prev]);
        if (photos.length > 0) {
          const { success, total } = await uploadPhotos(
            visit.id,
            photos.map((p) => p.base64)
          );
          if (success < total) {
            Alert.alert('사진 저장', `사진 ${total}장 중 ${success}장 저장됨`);
          }
        }
        // 그 방문일을 가본 루트에서 바로 보이게
        setView((v) =>
          v.mode === 'route' && v.routeStatus === 'visited'
            ? { ...v, selectedDate: visit.visited_on }
            : v
        );
        // STEP 4: 새로 다녀온 곳 저장도 같은 날 2번째면 자동 루트 감지
        runAutoRoute([saved, ...places], [visit, ...visits], saved, visit.visited_on);
      }
      // want는 날짜가 없어 루트 보기에 끼지 않는다(저장만).

      setPending(null);
    } catch (e) {
      Alert.alert('저장 실패', e instanceof Error ? e.message : '오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={INITIAL_REGION}
        showsUserLocation={status === 'granted'}
      >
        {!routeViewer &&
          places.map((p) => {
          // 카테고리 보기: 특정 분류만 보기로 했으면 나머지는 숨김 (실선·점선 핀 모두 함께)
          if (
            view.mode === 'category' &&
            view.filterCategoryId &&
            p.category_id !== view.filterCategoryId
          ) {
            return null;
          }
          const pin = importedPinInfo.get(p.id);
          return (
            <PlaceMarker
              key={p.id}
              coordinate={{ latitude: p.latitude, longitude: p.longitude }}
              markerStyle={{
                color: p.category_id ? categoryColorById.get(p.category_id) ?? null : null,
                status: p.status,
              }}
              label={pin ? String(pin.order) : undefined}
              start={pin?.isStart}
              onPress={() => {
                setSelectedPlace(p);
                setDetailPlace(null);
                setFriendCardPlace(null);
              }}
            />
          );
        })}

        {/* BUG 2-B: 같은 가져온 루트의 핀들을 order 순서대로 점선으로 잇는다(루트 밖/필터 중엔 안 그림) */}
        {!routeViewer &&
          !(view.mode === 'category' && view.filterCategoryId) &&
          importedRoutes.map((grp) => (
            <Polyline
              key={`imp-${grp.id}`}
              coordinates={grp.places.map((p) => ({
                latitude: p.latitude,
                longitude: p.longitude,
              }))}
              strokeColor="#9333ea"
              strokeWidth={3}
              lineDashPattern={[10, 6]}
            />
          ))}

        {!routeViewer && pending && (
          <Marker
            coordinate={{ latitude: pending.latitude, longitude: pending.longitude }}
            title={pending.name}
            pinColor="#2563eb"
          />
        )}

        {/* 통일 루트 뷰어 — 그 루트의 점들만 임시로 그린다(루트 밖 핀은 안 그림).
            순서 번호 + 시작 깃발, 현재 핀=빨강 강조. visited=실선/want=점선. 달력은 안 쓴다. */}
        {routeViewer && (
          <>
            {routeViewer.points.map((pt, i) => (
              <PlaceMarker
                key={pt.id}
                coordinate={{ latitude: pt.latitude, longitude: pt.longitude }}
                markerStyle={{
                  color:
                    i === routeViewer.index
                      ? '#ef4444'
                      : routeViewer.kind === 'visited'
                        ? '#1d4ed8'
                        : '#9333ea',
                  status: routeViewer.kind,
                }}
                label={String(i + 1)}
                start={i === 0}
              />
            ))}
            {routeViewer.points.length >= 2 && (
              <Polyline
                coordinates={routeViewer.points.map((pt) => ({
                  latitude: pt.latitude,
                  longitude: pt.longitude,
                }))}
                strokeColor="#1d4ed8"
                strokeWidth={5}
                lineDashPattern={routeViewer.kind === 'want' ? [12, 8] : undefined}
              />
            )}
          </>
        )}
      </MapView>

      {/* 뷰어 중에는 검색·버튼을 숨겨 루트 보기에 집중한다 */}
      {!routeViewer && (
        <>
          <SearchBar onSelect={handleSelect} />

          {/* 보기 전환 — 최상위는 [루트로 보기] / [카테고리로 보기] 둘 중 하나 */}
          <TouchableOpacity
            style={[styles.sideButton, styles.routeViewButton]}
            onPress={() => {
              // 루트로 보기 = 다녀온(visited) 날짜별 동선. want는 날짜가 없어 루트로 보기에서 빠진다.
              setView({ mode: 'route', routeStatus: 'visited', selectedDate: null });
              setCalendarVisible(true);
            }}
          >
            <Text style={styles.sideButtonText}>루트로 보기</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.sideButton, styles.categoryViewButton]}
            onPress={() => setCategoryPickerVisible(true)}
          >
            <Text style={styles.sideButtonText}>카테고리로 보기</Text>
          </TouchableOpacity>

          {/* 달력 — 루트 모드에서만. 현재 가본/가볼 기준으로 날짜를 다시 고른다 */}
          {view.mode === 'route' && (
            <TouchableOpacity
              style={[styles.sideButton, styles.calendarButton]}
              onPress={() => setCalendarVisible(true)}
            >
              <Text style={styles.sideButtonText}>달력</Text>
            </TouchableOpacity>
          )}

          {/* "내 위치" 버튼: 권한이 허용된 경우 보여준다 */}
          {status === 'granted' && (
            <TouchableOpacity
              style={[styles.sideButton, styles.locationButton]}
              onPress={handleRecenter}
            >
              <Text style={styles.sideButtonText}>내 위치</Text>
            </TouchableOpacity>
          )}

          {/* 카테고리 관리 모달 열기 */}
          <TouchableOpacity
            style={[styles.sideButton, styles.categoryManageButton]}
            onPress={() => setCategoryModalVisible(true)}
          >
            <Text style={styles.sideButtonText}>카테고리</Text>
          </TouchableOpacity>

          {/* 친구 관리 화면 열기 */}
          <TouchableOpacity
            style={[styles.sideButton, styles.friendsButton]}
            onPress={() => setFriendsVisible(true)}
          >
            <Text style={styles.sideButtonText}>친구</Text>
          </TouchableOpacity>

          {/* 루트 화면 열기 (내/친구/가져온 루트) */}
          <TouchableOpacity
            style={[styles.sideButton, styles.routesButton]}
            onPress={() => setRoutesVisible(true)}
          >
            <Text style={styles.sideButtonText}>루트</Text>
          </TouchableOpacity>

          {/* 권한 거부·오류 시 짧은 안내 (지도·기존 기능은 그대로 동작) */}
          {(status === 'denied' || status === 'error') && (
            <View style={styles.permissionNotice}>
              <Text style={styles.permissionNoticeText}>위치 권한이 필요합니다</Text>
            </View>
          )}
        </>
      )}

      {/* 루트 뷰어 하단 컨트롤 바 — 이전/다음/닫기 (+친구 루트면 가져오기) */}
      {routeViewer && (
        <RouteViewerBar
          info={{
            title: routeViewer.title,
            total: routeViewer.points.length,
            index: routeViewer.index,
            currentName: routeViewer.points[routeViewer.index]?.name ?? '',
            isFriendRoute: routeViewer.friendRoute !== null,
          }}
          imported={viewerImported}
          onPrev={() => handleViewerStep(-1)}
          onNext={() => handleViewerStep(1)}
          onClose={() => setRouteViewer(null)}
          onImport={handleViewerImport}
        />
      )}

      {/* FIX 4: 루트로 보기(날짜 동선) 화면 우상단 공유 버튼 — 동선을 곧 루트로 저장(공유=저장) */}
      {routeViewer && routeViewer.source === 'date' && selectedRoutePlaces.length >= 2 && (
        <TouchableOpacity style={styles.viewerShareButton} onPress={handleOpenShare}>
          <Text style={styles.viewerShareText}>공유</Text>
        </TouchableOpacity>
      )}

      <PlaceCard
        place={selectedPlace}
        visits={selectedPlaceVisits}
        categories={categories}
        onChangeCategory={handleChangeCategory}
        onChangeVisibility={handleChangeVisibility}
        onRequestAddVisit={handleRequestAddVisit}
        onClose={() => setSelectedPlace(null)}
      />

      {/* 저장 전 장소의 상세 카드 — 검색 결과 탭으로 진입 */}
      <PlaceDetailCard
        place={detailPlace}
        onSaveAs={handleSaveAs}
        onClose={() => setDetailPlace(null)}
      />

      {/* 친구의 공개 장소 — 읽기 전용 카드 (편집/체크인 없음, 내 데이터와 분리) */}
      <FriendPlaceCard picked={friendCardPlace} onClose={() => setFriendCardPlace(null)} />

      {/* 방문 추가/체크인 입력 시트 (날짜+메모+사진) */}
      <VisitInputModal
        visible={visitTarget !== null}
        title={visitTarget?.status === 'visited' ? '방문 추가' : '다녀왔어요!'}
        saving={savingVisit}
        onSubmit={handleSubmitVisit}
        onCancel={() => setVisitTarget(null)}
      />

      <CalendarModal
        visible={calendarVisible}
        recordedDates={calendarDates}
        selectedDate={view.mode === 'route' ? view.selectedDate : null}
        hint="점이 있는 날에 다녀온 기록이 있어요."
        onSelectDate={handleSelectDate}
        onClose={() => setCalendarVisible(false)}
      />

      <SavePlaceModal
        place={pending}
        initialStatus={pendingStatus}
        saving={saving}
        categories={categories}
        onCancel={() => setPending(null)}
        onSave={handleSave}
        onCreateCategory={addCategoryItem}
      />

      <CategoryModal
        visible={categoryModalVisible}
        categories={categories}
        onAdd={addCategoryItem}
        onRemove={handleRemoveCategory}
        onClose={() => setCategoryModalVisible(false)}
      />

      {/* 친구 화면 — 하나의 모달 안에서 [친구 관리]/[친구가 가본 곳] 탭 전환 */}
      <FriendsScreen
        visible={friendsVisible}
        onClose={() => setFriendsVisible(false)}
        onPickFriendPlace={handlePickFriendPlace}
      />

      {/* 루트 화면 — [내 루트]/[친구 루트]/[가져온 루트] */}
      <RoutesScreen
        visible={routesVisible}
        onClose={() => setRoutesVisible(false)}
        onOpenViewer={handleOpenViewer}
        onPlacesAdded={handlePlacesAddedFromImport}
      />

      {/* "이 루트 공유" — 제목·설명 입력 후 routes+route_items 생성 */}
      <ShareRouteModal
        visible={shareVisible}
        placeCount={selectedRoutePlaces.length}
        kind={view.mode === 'route' ? view.routeStatus : 'visited'}
        saving={sharing}
        onSubmit={handleShareRoute}
        onCancel={() => setShareVisible(false)}
      />

      {/* STEP 4 자동 루트 — 같은 날 2번째 체크인 시 제안 */}
      <AutoRouteModal
        visible={autoRoutePrompt !== null}
        placeCount={autoRoutePrompt?.placeCount ?? 0}
        saving={autoRouteSaving}
        onConfirm={handleAutoRouteConfirm}
        onDecline={handleAutoRouteDecline}
      />

      {/* [카테고리로 보기] 진입용 — 실선·점선 핀이 함께 보이고 분류 필터만 적용된다 */}
      <Modal
        visible={categoryPickerVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setCategoryPickerVisible(false)}
      >
        <View style={styles.pickerBackdrop}>
          <View style={styles.pickerSheet}>
            <Text style={styles.pickerTitle}>어떤 카테고리를 볼까요?</Text>

            <ScrollView style={styles.pickerList}>
              <TouchableOpacity
                style={styles.pickerItem}
                onPress={() => {
                  setView({ mode: 'category', filterCategoryId: null });
                  setCategoryPickerVisible(false);
                }}
              >
                <Text style={styles.pickerItemText}>전체 보기</Text>
              </TouchableOpacity>
              {categories.map((c) => (
                <TouchableOpacity
                  key={c.id}
                  style={styles.pickerItem}
                  onPress={() => {
                    setView({ mode: 'category', filterCategoryId: c.id });
                    setCategoryPickerVisible(false);
                  }}
                >
                  <View style={[styles.pickerDot, { backgroundColor: c.color }]} />
                  <Text style={styles.pickerItemText}>{c.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <TouchableOpacity
              style={styles.pickerCancel}
              onPress={() => setCategoryPickerVisible(false)}
            >
              <Text style={styles.pickerCancelText}>닫기</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    width: '100%',
    height: '100%',
  },
  // 오른쪽 떠 있는 버튼들의 공통 모양 — 위치(marginTop)와 색만 버튼별로 입힌다
  sideButton: {
    position: 'absolute',
    right: 16,
    top: '38%',
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  sideButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  routeViewButton: {
    backgroundColor: '#1d4ed8',
  },
  categoryViewButton: {
    marginTop: 56,
    backgroundColor: '#0f766e',
  },
  calendarButton: {
    marginTop: 112,
    backgroundColor: '#1d4ed8',
  },
  locationButton: {
    marginTop: 168,
    backgroundColor: '#1d4ed8',
  },
  categoryManageButton: {
    marginTop: 224,
    backgroundColor: '#7c3aed',
  },
  friendsButton: {
    marginTop: 280,
    backgroundColor: '#db2777',
  },
  routesButton: {
    marginTop: 336,
    backgroundColor: '#0891b2',
  },
  // 루트 뷰어 우상단 공유 버튼 (FIX 4)
  viewerShareButton: {
    position: 'absolute',
    top: 56,
    right: 16,
    backgroundColor: '#0891b2',
    borderRadius: 22,
    paddingHorizontal: 22,
    paddingVertical: 11,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 5,
  },
  viewerShareText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  // 카테고리 고르기 리스트 모달
  pickerBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  pickerSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 32,
    maxHeight: '60%',
  },
  pickerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  pickerList: {
    maxHeight: 280,
  },
  pickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  pickerDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    marginRight: 10,
  },
  pickerItemText: {
    fontSize: 16,
    color: '#111827',
    fontWeight: '600',
  },
  pickerCancel: {
    backgroundColor: '#f3f4f6',
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 14,
  },
  pickerCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  // 권한 거부 안내 — 화면 하단 중앙에 작게
  permissionNotice: {
    position: 'absolute',
    bottom: 24,
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  permissionNoticeText: {
    color: '#fff',
    fontSize: 13,
  },
});
