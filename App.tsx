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
import { useCurrentLocation } from './hooks/useCurrentLocation';
import { useCategories } from './hooks/useCategories';

// 보기모드: 날짜뷰(동선) / 카테고리뷰(분류 색 핀)
type ViewMode = 'date' | 'category';

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
  // 달력에서 고른 날짜 (이 날짜의 핀·동선만 강조, 나머지는 흐리게)
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  // 달력 열림 여부
  const [calendarVisible, setCalendarVisible] = useState(false);
  // 핀을 눌렀을 때 보여줄 장소 카드
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);
  // 현재 위치 + 위치 권한 상태 (별도 훅으로 분리)
  const { location, status, refreshLocation } = useCurrentLocation();
  // 카테고리 목록 + 추가/삭제
  const { categories, add: addCategoryItem, remove: removeCategoryItem } = useCategories();
  // 보기모드 (기본: 날짜뷰)
  const [viewMode, setViewMode] = useState<ViewMode>('date');
  // 카테고리 관리 모달 열림 여부
  const [categoryModalVisible, setCategoryModalVisible] = useState(false);
  // 카테고리뷰 진입 시 보여줄 "카테고리 고르기" 리스트 열림 여부
  const [categoryPickerVisible, setCategoryPickerVisible] = useState(false);
  // 카테고리뷰에서의 필터 (null = 전체)
  const [filterCategoryId, setFilterCategoryId] = useState<string | null>(null);

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
        // (가보고 싶은 곳은 날짜가 없으므로 제외)
        const firstVisited = rows.find((r) => r.status === 'visited' && r.visited_on);
        if (firstVisited) setSelectedDate(firstVisited.visited_on);
      })
      .catch((e) =>
        Alert.alert('불러오기 실패', e instanceof Error ? e.message : '오류가 발생했습니다.')
      );
  }, []);

  // 기록(다녀온 장소)이 있는 날짜들 (중복 제거) — 달력에 점으로 표시
  // 동선·달력은 '다녀온 곳'만 대상으로 한다 (가보고 싶은 곳은 제외)
  const recordedDates = useMemo(
    () =>
      Array.from(
        new Set(
          places
            .filter((p) => p.status === 'visited' && p.visited_on)
            .map((p) => p.visited_on as string)
        )
      ),
    [places]
  );

  // 선택된 날짜의 "다녀온" 장소들을 시간순(저장한 순서)으로 정렬 → 동선용
  const selectedDayPlaces = useMemo(() => {
    if (!selectedDate) return [];
    return places
      .filter((p) => p.status === 'visited' && p.visited_on === selectedDate)
      .sort((a, b) => a.created_at.localeCompare(b.created_at));
  }, [places, selectedDate]);

  // 동선(선)을 그릴 좌표 목록
  const selectedPath = useMemo(
    () => selectedDayPlaces.map((p) => ({ latitude: p.latitude, longitude: p.longitude })),
    [selectedDayPlaces]
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

  // 달력에서 날짜를 고르면: 그 날짜를 강조하고 첫 장소로 지도 이동
  function handleSelectDate(date: string) {
    setSelectedDate(date);
    setCalendarVisible(false);
    setSelectedPlace(null);
    const first = places
      .filter((p) => p.status === 'visited' && p.visited_on === date)
      .sort((a, b) => a.created_at.localeCompare(b.created_at))[0];
    if (first) {
      mapRef.current?.animateToRegion({
        latitude: first.latitude,
        longitude: first.longitude,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      });
    }
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
    if (filterCategoryId === id) setFilterCategoryId(null);
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
    categoryId: string | null
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
        memo: memo || null,
        address: pending.address || null,
        kakao_place_id: pending.id,
        category_id: categoryId,
      });
      setPlaces((prev) => [saved, ...prev]);
      // 다녀온 곳을 저장했으면 그 날짜를 선택해 동선이 바로 보이게
      if (saved.status === 'visited' && saved.visited_on) setSelectedDate(saved.visited_on);

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
          // 카테고리뷰에서 특정 분류만 보기로 했으면 나머지는 숨김
          if (viewMode === 'category' && filterCategoryId && p.category_id !== filterCategoryId) {
            return null;
          }
          // 날짜뷰: 선택된 날짜가 아니면 핀을 흐리게 (카테고리뷰는 전부 선명하게)
          const dimmed =
            viewMode === 'date' && selectedDate !== null && p.visited_on !== selectedDate;
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

        {viewMode === 'date' && selectedPath.length >= 2 && (
          <Polyline coordinates={selectedPath} strokeColor="#1d4ed8" strokeWidth={5} />
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

      <TouchableOpacity
        style={styles.calendarButton}
        onPress={() => setCalendarVisible(true)}
      >
        <Text style={styles.calendarButtonText}>달력</Text>
      </TouchableOpacity>

      {/* "내 위치" 버튼: 권한이 허용된 경우 보여준다 */}
      {status === 'granted' && (
        <TouchableOpacity style={styles.locationButton} onPress={handleRecenter}>
          <Text style={styles.locationButtonText}>내 위치</Text>
        </TouchableOpacity>
      )}

      {/* 보기모드 버튼 — 날짜뷰에서 누르면 카테고리 고르기 리스트가 열리고,
          카테고리뷰에서 누르면 날짜뷰로 돌아온다. (라벨 = 누르면 이동할 곳) */}
      <TouchableOpacity
        style={styles.viewModeButton}
        onPress={() => {
          if (viewMode === 'date') {
            setCategoryPickerVisible(true);
          } else {
            setViewMode('date');
            setFilterCategoryId(null);
          }
        }}
      >
        <Text style={styles.viewModeButtonText}>
          {viewMode === 'date' ? '카테고리뷰' : '날짜뷰'}
        </Text>
      </TouchableOpacity>

      {/* 카테고리 관리 모달 열기 */}
      <TouchableOpacity
        style={styles.categoryButton}
        onPress={() => setCategoryModalVisible(true)}
      >
        <Text style={styles.categoryButtonText}>카테고리</Text>
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
        recordedDates={recordedDates}
        selectedDate={selectedDate}
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

      {/* 카테고리뷰 진입용 고르기 리스트 — 고르면 그 분류의 핀만 보인다 */}
      <Modal
        visible={categoryPickerVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setCategoryPickerVisible(false)}
      >
        <View style={styles.pickerBackdrop}>
          <View style={styles.pickerSheet}>
            <Text style={styles.pickerTitle}>어떤 카테고리를 볼까요?</Text>

            {categories.length === 0 ? (
              <Text style={styles.pickerEmpty}>
                아직 카테고리가 없습니다. '카테고리' 버튼에서 먼저 만들어 주세요.
              </Text>
            ) : (
              <ScrollView style={styles.pickerList}>
                <TouchableOpacity
                  style={styles.pickerItem}
                  onPress={() => {
                    setFilterCategoryId(null);
                    setViewMode('category');
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
                      setFilterCategoryId(c.id);
                      setViewMode('category');
                      setCategoryPickerVisible(false);
                    }}
                  >
                    <View style={[styles.pickerDot, { backgroundColor: c.color }]} />
                    <Text style={styles.pickerItemText}>{c.name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}

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
  calendarButton: {
    position: 'absolute',
    right: 16,
    top: '45%',
    backgroundColor: '#1d4ed8',
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  calendarButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  // "내 위치" 버튼 — 달력 버튼 바로 아래 같은 스타일로
  locationButton: {
    position: 'absolute',
    right: 16,
    top: '45%',
    marginTop: 56,
    backgroundColor: '#1d4ed8',
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  locationButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  // 보기모드 토글 버튼 — 내 위치 버튼 아래
  viewModeButton: {
    position: 'absolute',
    right: 16,
    top: '45%',
    marginTop: 112,
    backgroundColor: '#0f766e',
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  viewModeButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  // 카테고리 관리 버튼 — 보기모드 버튼 아래
  categoryButton: {
    position: 'absolute',
    right: 16,
    top: '45%',
    marginTop: 168,
    backgroundColor: '#7c3aed',
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  categoryButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
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
  pickerEmpty: {
    fontSize: 14,
    color: '#9ca3af',
    paddingVertical: 12,
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
