import { StyleSheet, View } from 'react-native';
import { Marker } from 'react-native-maps';

// 핀의 "겉모습"에 대한 값들을 한 곳에 모은 타입.
// B2에서 상태 표현(가본=진함 / 가볼=흐림+점선 / 가져온=점선+출처)이 추가될 예정이므로
// 새 표시 요소가 생기면 이 타입에 필드를 추가한다. (지금은 색만)
export type PlaceMarkerStyle = {
  color?: string | null; // 카테고리 색. 없으면 기본색.
};

// 분류가 없는 핀의 기본색
const DEFAULT_COLOR = '#ef4444';

type Props = {
  coordinate: { latitude: number; longitude: number };
  markerStyle?: PlaceMarkerStyle;
  opacity?: number;
  onPress?: () => void;
};

// 카테고리 색을 입힌 커스텀 핀 (흰 테두리 원형 점)
export default function PlaceMarker({ coordinate, markerStyle, opacity = 1, onPress }: Props) {
  const color = markerStyle?.color || DEFAULT_COLOR;

  return (
    <Marker coordinate={coordinate} onPress={onPress} anchor={{ x: 0.5, y: 0.5 }}>
      {/* 흐림(opacity)은 Marker가 아니라 안쪽 뷰에 적용해야 iOS에서도 확실히 먹는다 */}
      <View style={[styles.dot, { backgroundColor: color, opacity }]} />
    </Marker>
  );
}

const styles = StyleSheet.create({
  dot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 3,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 3,
  },
});
