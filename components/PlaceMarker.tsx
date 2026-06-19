import { StyleSheet, Text, View } from 'react-native';
import { Marker } from 'react-native-maps';
import { PlaceStatus } from '../lib/places';

// 핀의 "겉모습"에 대한 값들을 한 곳에 모은 타입.
// 새 표시 요소가 생기면 이 타입에 필드를 추가한다.
export type PlaceMarkerStyle = {
  color?: string | null; // 카테고리 색. 없으면 기본색.
  // 상태별 선 스타일: visited=실선(꽉 찬 원) / want·imported=점선 테두리(흐린 느낌)
  status?: PlaceStatus;
};

// 분류가 없는 핀의 기본색
const DEFAULT_COLOR = '#ef4444';

type Props = {
  coordinate: { latitude: number; longitude: number };
  markerStyle?: PlaceMarkerStyle;
  opacity?: number;
  onPress?: () => void;
  // 가져온 루트 핀에 표시할 순서 번호(1부터). 없으면 표시 안 함.
  label?: string;
  // 루트 시작점이면 깃발 표시.
  start?: boolean;
};

// 카테고리 색 + 상태별 선 스타일을 입힌 커스텀 핀
export default function PlaceMarker({
  coordinate,
  markerStyle,
  opacity = 1,
  onPress,
  label,
  start,
}: Props) {
  const color = markerStyle?.color || DEFAULT_COLOR;
  // visited(기본)는 실선, want/imported는 점선
  const dashed = markerStyle?.status === 'want' || markerStyle?.status === 'imported';

  return (
    <Marker coordinate={coordinate} onPress={onPress} anchor={{ x: 0.5, y: 0.5 }}>
      {/* 흐림(opacity)은 Marker가 아니라 안쪽 뷰에 적용해야 iOS에서도 확실히 먹는다 */}
      <View style={styles.wrap}>
        {start && <Text style={styles.flag}>🚩</Text>}
        {dashed ? (
          <View style={[styles.dashedDot, { borderColor: color, opacity }]}>
            {label ? <Text style={[styles.num, { color }]}>{label}</Text> : null}
          </View>
        ) : (
          <View style={[styles.dot, { backgroundColor: color, opacity }]}>
            {label ? <Text style={styles.numLight}>{label}</Text> : null}
          </View>
        )}
      </View>
    </Marker>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center' },
  // 루트 시작점 깃발
  flag: { fontSize: 15, marginBottom: -2 },
  // 실선 핀: 카테고리 색 꽉 찬 원 + 흰 테두리
  dot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 3,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 3,
  },
  // 점선 핀: 반투명 흰 바탕 + 카테고리 색 점선 테두리 (흐린 느낌)
  dashedDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2.5,
    borderStyle: 'dashed',
    backgroundColor: 'rgba(255,255,255,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // 순서 번호 (점선=카테고리색 글자 / 실선=흰 글자)
  num: { fontSize: 11, fontWeight: '700' },
  numLight: { fontSize: 11, fontWeight: '700', color: '#fff' },
});
