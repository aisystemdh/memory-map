import { Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { KakaoPlace } from '../lib/kakao';
import { PlaceStatus } from '../lib/places';

type Props = {
  // 보여줄 장소 (라벨 마커 탭 / 검색 결과 탭 공용). null이면 카드가 닫힘.
  place: KakaoPlace | null;
  // 찜(want) 또는 기록(visited)을 골라 저장 모달로 넘어간다
  onSaveAs: (place: KakaoPlace, status: PlaceStatus) => void;
  onClose: () => void;
};

// 아직 저장하지 않은 장소의 상세 카드 — 모든 장소 발견 경로(검색·라벨)의 공통 진입점.
// 내 저장 핀의 카드(PlaceCard)와는 별개다.
export default function PlaceDetailCard({ place, onSaveAs, onClose }: Props) {
  if (!place) return null;

  // 전화번호의 숫자만 추려 전화앱으로 연결
  function handleCall() {
    if (!place || !place.phone) return;
    const digits = place.phone.replace(/[^0-9+]/g, '');
    if (digits) Linking.openURL(`tel:${digits}`);
  }

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.name} numberOfLines={1}>
          {place.name}
        </Text>
        <TouchableOpacity onPress={onClose} hitSlop={10}>
          <Text style={styles.close}>✕</Text>
        </TouchableOpacity>
      </View>

      {place.address ? <Text style={styles.address}>{place.address}</Text> : null}
      {place.category ? <Text style={styles.category}>{place.category}</Text> : null}

      {/* 전화번호가 있을 때만 — 탭하면 전화앱으로 */}
      {place.phone ? (
        <TouchableOpacity style={styles.phoneRow} onPress={handleCall}>
          <Text style={styles.phoneText}>📞 {place.phone}</Text>
        </TouchableOpacity>
      ) : null}

      {/* 리뷰·사진 자리 — 데이터 연결은 E1(리뷰)에서. 지금은 구조만. */}
      <View style={styles.placeholder}>
        <Text style={styles.placeholderText}>리뷰·사진 준비 중</Text>
      </View>

      <View style={styles.buttonRow}>
        <TouchableOpacity
          style={[styles.button, styles.wantButton]}
          onPress={() => onSaveAs(place, 'want')}
        >
          <Text style={styles.wantButtonText}>가볼 곳으로 찜</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.button, styles.visitedButton]}
          onPress={() => onSaveAs(place, 'visited')}
        >
          <Text style={styles.visitedButtonText}>다녀온 곳으로 기록</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 24,
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 5,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  name: {
    flex: 1,
    fontSize: 19,
    fontWeight: '700',
    color: '#111827',
    marginRight: 8,
  },
  close: {
    fontSize: 16,
    color: '#6b7280',
    paddingHorizontal: 6,
  },
  address: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 4,
  },
  category: {
    fontSize: 13,
    color: '#9ca3af',
    marginTop: 2,
  },
  phoneRow: {
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  phoneText: {
    fontSize: 15,
    color: '#2563eb',
    fontWeight: '600',
  },
  placeholder: {
    backgroundColor: '#f9fafb',
    borderRadius: 10,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 12,
  },
  placeholderText: {
    fontSize: 13,
    color: '#9ca3af',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  button: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
  },
  wantButton: {
    backgroundColor: '#eff6ff',
    borderWidth: 1.5,
    borderColor: '#2563eb',
  },
  wantButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1d4ed8',
  },
  visitedButton: {
    backgroundColor: '#2563eb',
  },
  visitedButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
});
