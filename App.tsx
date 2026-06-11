import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import MapView, { Marker, Polyline, Region } from 'react-native-maps';
import CalendarModal from './components/CalendarModal';
import CategoryModal from './components/CategoryModal';
import PlaceCard from './components/PlaceCard';
import PlaceMarker from './components/PlaceMarker';
import SavePlaceModal from './components/SavePlaceModal';
import SearchBar from './components/SearchBar';
import { KakaoPlace } from './lib/kakao';
import {
  addPlace,
  checkInPlace,
  fetchPlaces,
  updatePlaceCategory,
  Place,
  PlaceStatus,
} from './lib/places';
import { uploadPhotos, PickedPhoto } from './lib/photos';
import { routeDate, routeDates, routePlacesOn, RouteStatus } from './lib/routes';
import { useCurrentLocation } from './hooks/useCurrentLocation';
import { useCategories } from './hooks/useCategories';

// 보기 상태 — 최상위에서 [루트로 보기] / [카테고리로 보기]로 갈린다.
// 루트: 가본(visited_on) 또는 가볼(plan_date) 날짜별 동선. 카테고리: 전체 핀 + 분류 필터.
type ViewState =
  | { mode: 'category'; filterCategoryId: string | null } // null = 전체 보기
  | { mode: 'route'; routeStatus: RouteStatus; selectedDate: string | null };

const INITIAL_REGION: Region = {
  latitude: 37.5665,
  longitude: 126.978,
  latitudeDelta: 0.05,
  longitudeDelta: 0.05,
};

export default function App() {
  const mapRef = useRef<MapView>(null);
  // Supabase에 저장된 핀들
  const [places, setPlaces] = useState<Place[]>([]);
  // 검색으로 고른, 아직 저장 전인 장소 (미리보기 핀 + 저장 모달용)
  const [pending, setPending] = useState<KakaoPlace | null>(null);
  const [saving, setSaving] = useState(false);
  // 보기 상태 (기본: 루트로 보기 > 가본 곳, 날짜는 핀 로딩 후 최근 방문일로)
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

  // 핀 색 결정용: 카테고리 id → 색
  const categoryColorById = useMemo(
    () => new Map(categories.map((c) => [c.id, c.color])),
    [categories]
  );

  // 앱 시작 시 저장된 핀 불러오기
  useEffect(() => {
    fetchPlaces()
      .then((rows) => {
        setPlaces(rows);
        // 가장 최근에 "다녀온" 장소의 날짜를 기본 선택해서 동선이 바로 보이게
        const firstVisited = rows.find((r) => r.status === 'visited' && r.visited_on);
        if (firstVisited) {
          setView({ mode: 'route', routeStatus: 'visited', selectedDate: firstVisited.visited_on });
        }
      })
      .catch((e) =>
        Alert.alert('불러오기 실패', e instanceof Error ? e.message : '오류가 발생했습니다.')
      );
  }, []);

  // 달력에 활성화할 날짜들 — 가본=visited_on, 가볼=plan_date 기준 (루트 모드에서만 의미 있음)
  const calendarDates = useMemo(
    () => (view.mode === 'route' ? routeDates(places, view.routeStatus) : []),
    [places, view]
  );

  // 선택된 날짜의 루트 장소들 (시간순) → 동선용
  const selectedRoutePlaces = useMemo(() => {
    if (view.mode !== 'route' || !view.selectedDate) return [];
    return routePlacesOn(places, view.routeStatus, view.selectedDate);
  }, [places, view]);

  // 동선(선)을 그릴 좌표 목록
  const selectedPath = useMemo(
    () => selectedRoutePlaces.map((p) => ({ latitude: p.latitude, longitude: p.longitude })),
    [selectedRoutePlaces]
  );

  // 검색 결과를 선택하면 지도 이동 + 저장 모달 열기
  function handleSelect(place: KakaoPlace) {
    setPending(place);
    mapRef.current?.animateToRegion({
      latitude: place.latitude,
      longitude: place.longitude,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    });
  }

  // 달력에서 날짜를 고르면: 그 날짜의 루트를 강조하고 첫 장소로 지도 이동
  // (달력은 루트 모드에서만 열린다)
  function handleSelectDate(date: string) {
    if (view.mode !== 'route') return;
    setView({ ...view, selectedDate: date });
    setCalendarVisible(false);
    setSelectedPlace(null);
    const first = routePlacesOn(places, view.routeStatus, date)[0];
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
  // 아직 위치를 못 가져왔으면 그 자리에서 한 번 더 시도한다.
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

  // 카테고리 삭제: DB가 장소의 분류를 자동 해제(SET NULL)하므로 화면 상태도 맞춰준다.
  async function handleRemoveCategory(id: string) {
    const ok = await removeCategoryItem(id);
    if (!ok) return;
    setPlaces((prev) =>
      prev.map((p) => (p.category_id === id ? { ...p, category_id: null } : p))
    );
    setSelectedPlace((prev) =>
      prev && prev.category_id === id ? { ...prev, category_id: null } : prev
    );
    // 지운 카테고리로 필터 중이었다면 전체 보기로
    setView((v) =>
      v.mode === 'category' && v.filterCategoryId === id ? { ...v, filterCategoryId: null } : v
    );
  }

  // 체크인: 가보고 싶은 곳 → 다녀온 곳 (방문 날짜 = 오늘, 메모는 선택). source는 보존된다.
  async function handleCheckIn(placeId: string, memo: string) {
    try {
      const result = await checkInPlace(placeId, memo);
      const apply = (p: Place): Place => ({
        ...p,
        status: 'visited' as const,
        visited_on: result.visited_on,
        // 메모를 입력했을 때만 갱신 (비우면 기존 값 유지)
        memo: result.memo ?? p.memo,
      });
      setPlaces((prev) => prev.map((p) => (p.id === placeId ? apply(p) : p)));
      setSelectedPlace((prev) => (prev && prev.id === placeId ? apply(prev) : prev));
    } catch (e) {
      Alert.alert('체크인 실패', e instanceof Error ? e.message : '오류가 발생했습니다.');
    }
  }

  // 모달에서 저장 누르면 Supabase에 저장 (+ 고른 사진 업로드)
  async function handleSave(
    status: PlaceStatus,
    visitedOn: string | null,
    memo: string,
    photos: PickedPhoto[],
    categoryId: string | null,
    planDate: string | null,
    planWith: string | null
  ) {
    if (!pending) return;
    setSaving(true);
    try {
      const saved = await addPlace({
        name: pending.name,
        latitude: pending.latitude,
        longitude: pending.longitude,
        status,
        visited_on: visitedOn,
        plan_date: planDate,
        plan_with: planWith,
        memo: memo || null,
        address: pending.address || null,
        kakao_place_id: pending.id,
        category_id: categoryId,
      });
      setPlaces((prev) => [saved, ...prev]);
      // 지금 보고 있는 루트에 속하는 저장이면 그 날짜를 선택해 동선이 바로 보이게
      setView((v) => {
        if (v.mode !== 'route') return v;
        const d = routeDate(saved, v.routeStatus);
        return d ? { ...v, selectedDate: d } : v;
      });

      // 장소가 저장되어 place_id가 생겼으니 사진을 업로드한다.
      // 일부 실패해도 장소 저장은 되돌리지 않고, 결과만 알려준다.
      if (photos.length > 0) {
        const { success, total } = await uploadPhotos(
          saved.id,
          photos.map((p) => p.base64)
        );
        if (success < total) {
          Alert.alert('사진 저장', `사진 ${total}장 중 ${success}장 저장됨`);
        }
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
            view.mode === 'route' &&
            view.selectedDate !== null &&
            routeDate(p, view.routeStatus) !== view.selectedDate;
          return (
            <PlaceMarker
              key={p.id}
              coordinate={{ latitude: p.latitude, longitude: p.longitude }}
              markerStyle={{
                color: p.category_id ? categoryColorById.get(p.category_id) ?? null : null,
                status: p.status,
              }}
              opacity={dimmed ? 0.3 : 1}
              onPress={() => setSelectedPlace(p)}
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


      {/* 권한 거부·오류 시 짧은 안내 (지도·기존 기능은 그대로 동작) */}
      {(status === 'denied' || status === 'error') && (
        <View style={styles.permissionNotice}>
          <Text style={styles.permissionNoticeText}>위치 권한이 필요합니다</Text>
        </View>
      )}

      <PlaceCard
        place={selectedPlace}
        categories={categories}
        onChangeCategory={handleChangeCategory}
        onCheckIn={handleCheckIn}
        onClose={() => setSelectedPlace(null)}
      />

      <CalendarModal
        visible={calendarVisible}
        recordedDates={calendarDates}
        selectedDate={view.mode === 'route' ? view.selectedDate : null}
        hint={
          view.mode === 'route' && view.routeStatus === 'want'
            ? '점이 있는 날에 가기로 한 장소가 있어요.'
            : '점이 있는 날에 기록한 장소가 있어요.'
        }
        onSelectDate={handleSelectDate}
        onClose={() => setCalendarVisible(false)}
      />

      <SavePlaceModal
        place={pending}
        saving={saving}
        categories={categories}
        onCancel={() => setPending(null)}
        onSave={handleSave}
      />

      <CategoryModal
        visible={categoryModalVisible}
        categories={categories}
        onAdd={addCategoryItem}
        onRemove={handleRemoveCategory}
        onClose={() => setCategoryModalVisible(false)}
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

            <TouchableOpacity
              style={styles.pickerItem}
              onPress={() => handlePickRoute('visited')}
            >
              <Text style={styles.pickerItemText}>가본 곳 — 다녀온 날짜별 동선</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.pickerItem}
              onPress={() => handlePickRoute('want')}
            >
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
