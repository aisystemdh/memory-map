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
  // [루트로 보기] 진입 시 "가본/가볼 곳 고르기" 시트 열림 여부
  const [routePickerVisible, setRoutePickerVisible] = useState(false);
  // [카테고리로 보기] 진입 시 "카테고리 고르기" 시트 열림 여부
  const [categoryPickerVisible, setCategoryPickerVisible] = useState(false);
  // 친구 화면(관리+친구장소 탭) 열림 여부
  const [friendsVisible, setFriendsVisible] = useState(false);
  // 지도에서 보여줄 친구의 공개 장소 (읽기 전용 카드). 내 places 상태와 별개 — 오염 방지.
  const [friendCardPlace, setFriendCardPlace] = useState<PickedFriendPlace | null>(null);

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

  // 선택된 날짜의 루트 장소들 (시간순) → 동선용
  const selectedRoutePlaces = useMemo(() => {
    if (view.mode !== 'route' || !view.selectedDate) return [];
    return routePlacesOn(places, visits, view.routeStatus, view.selectedDate);
  }, [places, visits, view]);

  // 동선(선)을 그릴 좌표 목록
  const selectedPath = useMemo(
    () => selectedRoutePlaces.map((p) => ({ latitude: p.latitude, longitude: p.longitude })),
    [selectedRoutePlaces]
  );

  // 선택 날짜 루트에 속한 place id 집합 — 핀 흐림(dimmed) 판단용
  const routePlaceIds = useMemo(
    () => new Set(selectedRoutePlaces.map((p) => p.id)),
    [selectedRoutePlaces]
  );

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
      Alert.alert('이미 저장한 곳이에요', '이 장소에 방문을 추가할까요?', [
        { text: '취소', style: 'cancel' },
        {
          text: '방문 추가',
          onPress: () => {
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

  // 달력에서 날짜를 고르면: 그 날짜의 루트를 강조하고 첫 장소로 지도 이동
  function handleSelectDate(date: string) {
    if (view.mode !== 'route') return;
    setView({ ...view, selectedDate: date });
    setCalendarVisible(false);
    setSelectedPlace(null);
    const first = routePlacesOn(places, visits, view.routeStatus, date)[0];
    if (first) {
      mapRef.current?.animateToRegion({
        latitude: first.latitude,
        longitude: first.longitude,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      });
    }
  }

  // [루트로 보기]에서 가본/가볼 곳을 고르면 그 루트 모드로 바꾸고 곧장 달력을 연다
  function handlePickRoute(routeStatus: RouteStatus) {
    setView({ mode: 'route', routeStatus, selectedDate: null });
    setRoutePickerVisible(false);
    setCalendarVisible(true);
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
      } else if (planDate) {
        // 가볼 곳 — 계획일을 가볼 루트에서 바로 보이게
        setView((v) =>
          v.mode === 'route' && v.routeStatus === 'want' ? { ...v, selectedDate: planDate } : v
        );
      }

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
        {places.map((p) => {
          // 카테고리 보기: 특정 분류만 보기로 했으면 나머지는 숨김 (실선·점선 핀 모두 함께)
          if (
            view.mode === 'category' &&
            view.filterCategoryId &&
            p.category_id !== view.filterCategoryId
          ) {
            return null;
          }
          // 루트 보기: 선택된 날짜의 루트가 아니면 핀을 흐리게 (카테고리 보기는 전부 선명하게)
          const dimmed =
            view.mode === 'route' && view.selectedDate !== null && !routePlaceIds.has(p.id);
          return (
            <PlaceMarker
              key={p.id}
              coordinate={{ latitude: p.latitude, longitude: p.longitude }}
              markerStyle={{
                color: p.category_id ? categoryColorById.get(p.category_id) ?? null : null,
                status: p.status,
              }}
              opacity={dimmed ? 0.3 : 1}
              onPress={() => {
                setSelectedPlace(p);
                setDetailPlace(null);
                setFriendCardPlace(null);
              }}
            />
          );
        })}

        {/* 동선 — 가본 루트는 실선, 가볼 루트는 점선 (카테고리 보기엔 동선 없음) */}
        {view.mode === 'route' && selectedPath.length >= 2 && (
          <Polyline
            coordinates={selectedPath}
            strokeColor="#1d4ed8"
            strokeWidth={5}
            lineDashPattern={view.routeStatus === 'want' ? [12, 8] : undefined}
          />
        )}

        {pending && (
          <Marker
            coordinate={{ latitude: pending.latitude, longitude: pending.longitude }}
            title={pending.name}
            pinColor="#2563eb"
          />
        )}
      </MapView>

      <SearchBar onSelect={handleSelect} />

      {/* 보기 전환 — 최상위는 [루트로 보기] / [카테고리로 보기] 둘 중 하나 */}
      <TouchableOpacity
        style={[styles.sideButton, styles.routeViewButton]}
        onPress={() => setRoutePickerVisible(true)}
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

      {/* 권한 거부·오류 시 짧은 안내 (지도·기존 기능은 그대로 동작) */}
      {(status === 'denied' || status === 'error') && (
        <View style={styles.permissionNotice}>
          <Text style={styles.permissionNoticeText}>위치 권한이 필요합니다</Text>
        </View>
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
        hint={
          view.mode === 'route' && view.routeStatus === 'want'
            ? '점이 있는 날에 가기로 한 장소가 있어요.'
            : '점이 있는 날에 다녀온 기록이 있어요.'
        }
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

      {/* [루트로 보기] 진입용 — 가본 곳/가볼 곳을 고르면 달력이 이어서 열린다 */}
      <Modal
        visible={routePickerVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setRoutePickerVisible(false)}
      >
        <View style={styles.pickerBackdrop}>
          <View style={styles.pickerSheet}>
            <Text style={styles.pickerTitle}>어떤 루트를 볼까요?</Text>

            <TouchableOpacity style={styles.pickerItem} onPress={() => handlePickRoute('visited')}>
              <Text style={styles.pickerItemText}>가본 곳 — 다녀온 날짜별 동선</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.pickerItem} onPress={() => handlePickRoute('want')}>
              <Text style={styles.pickerItemText}>가볼 곳 — 계획일별 동선</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.pickerCancel}
              onPress={() => setRoutePickerVisible(false)}
            >
              <Text style={styles.pickerCancelText}>닫기</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

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
