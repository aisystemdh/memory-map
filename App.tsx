import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import MapView, { Marker, Polyline, Region } from 'react-native-maps';
import SavePlaceModal from './components/SavePlaceModal';
import SearchBar from './components/SearchBar';
import { KakaoPlace } from './lib/kakao';
import { addPlace, fetchPlaces, Place } from './lib/places';

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
  // 선택된 날짜 (이 날짜의 핀들만 또렷하게 + 선으로 연결). 핀을 누르면 그 날짜로 바뀜.
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // 앱 시작 시 저장된 핀 불러오기
  useEffect(() => {
    fetchPlaces()
      .then((rows) => {
        setPlaces(rows);
        // 별도 달력 UI 없이도 바로 보이도록, 가장 최근에 저장한 날짜를 기본 선택
        if (rows.length > 0) setSelectedDate(rows[0].visited_on);
      })
      .catch((e) =>
        Alert.alert('불러오기 실패', e instanceof Error ? e.message : '오류가 발생했습니다.')
      );
  }, []);

  // 선택된 날짜의 장소들을 시간순(저장한 순서)으로 정렬한 좌표 목록
  const selectedPath = useMemo(() => {
    if (!selectedDate) return [];
    return places
      .filter((p) => p.visited_on === selectedDate)
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .map((p) => ({ latitude: p.latitude, longitude: p.longitude }));
  }, [places, selectedDate]);

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

  // 모달에서 저장 누르면 Supabase에 저장
  async function handleSave(visitedOn: string, memo: string) {
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
      setPending(null);
    } catch (e) {
      Alert.alert('저장 실패', e instanceof Error ? e.message : '오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={styles.container}>
      <MapView ref={mapRef} style={styles.map} initialRegion={INITIAL_REGION}>
        {places.map((p) => {
          // 선택된 날짜가 아니면 핀을 흐리게
          const dimmed = selectedDate !== null && p.visited_on !== selectedDate;
          return (
            <Marker
              key={p.id}
              coordinate={{ latitude: p.latitude, longitude: p.longitude }}
              title={`${p.name} (${p.visited_on})`}
              description={p.memo ?? undefined}
              opacity={dimmed ? 0.3 : 1}
              onPress={() => setSelectedDate(p.visited_on)}
            />
          );
        })}

        {selectedPath.length >= 2 && (
          <Polyline
            coordinates={selectedPath}
            strokeColor="#1d4ed8"
            strokeWidth={5}
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
});
