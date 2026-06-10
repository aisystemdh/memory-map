import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import MapView, { Marker, Polyline, Region } from 'react-native-maps';
import CalendarModal from './components/CalendarModal';
import PlaceCard from './components/PlaceCard';
import SavePlaceModal from './components/SavePlaceModal';
import SearchBar from './components/SearchBar';
import { KakaoPlace } from './lib/kakao';
import { addPlace, fetchPlaces, Place } from './lib/places';
import { uploadPhotos, PickedPhoto } from './lib/photos';
import { useCurrentLocation } from './hooks/useCurrentLocation';

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

  // 앱 시작 시 저장된 핀 불러오기
  useEffect(() => {
    fetchPlaces()
      .then((rows) => {
        setPlaces(rows);
        // 가장 최근에 기록한 날짜를 기본 선택해서 동선이 바로 보이게
        if (rows.length > 0) setSelectedDate(rows[0].visited_on);
      })
      .catch((e) =>
        Alert.alert('불러오기 실패', e instanceof Error ? e.message : '오류가 발생했습니다.')
      );
  }, []);

  // 기록(장소)이 있는 날짜들 (중복 제거) — 달력에 점으로 표시
  const recordedDates = useMemo(
    () => Array.from(new Set(places.map((p) => p.visited_on))),
    [places]
  );

  // 선택된 날짜의 장소들을 시간순(저장한 순서)으로 정렬
  const selectedDayPlaces = useMemo(() => {
    if (!selectedDate) return [];
    return places
      .filter((p) => p.visited_on === selectedDate)
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
      .filter((p) => p.visited_on === date)
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

  // 모달에서 저장 누르면 Supabase에 저장 (+ 고른 사진 업로드)
  async function handleSave(visitedOn: string, memo: string, photos: PickedPhoto[]) {
    if (!pending) return;
    setSaving(true);
    try {
      const saved = await addPlace({
        name: pending.name,
        latitude: pending.latitude,
        longitude: pending.longitude,
        visited_on: visitedOn,
        memo: memo || null,
        address: pending.address || null,
        kakao_place_id: pending.id,
      });
      setPlaces((prev) => [saved, ...prev]);
      setSelectedDate(saved.visited_on);

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
          // 선택된 날짜가 아니면 핀을 흐리게
          const dimmed = selectedDate !== null && p.visited_on !== selectedDate;
          return (
            <Marker
              key={p.id}
              coordinate={{ latitude: p.latitude, longitude: p.longitude }}
              opacity={dimmed ? 0.3 : 1}
              onPress={() => setSelectedPlace(p)}
            />
          );
        })}

        {selectedPath.length >= 2 && (
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

      {/* 권한 거부·오류 시 짧은 안내 (지도·기존 기능은 그대로 동작) */}
      {(status === 'denied' || status === 'error') && (
        <View style={styles.permissionNotice}>
          <Text style={styles.permissionNoticeText}>위치 권한이 필요합니다</Text>
        </View>
      )}

      <PlaceCard place={selectedPlace} onClose={() => setSelectedPlace(null)} />

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
        onCancel={() => setPending(null)}
        onSave={handleSave}
      />
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
