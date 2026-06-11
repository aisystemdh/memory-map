import { StyleSheet, Text, View } from 'react-native';
import { Marker } from 'react-native-maps';
import { KakaoPlace } from '../lib/kakao';

type Props = {
  place: KakaoPlace;
  onPress: () => void;
};

// 주변 장소의 작은 "상호명 라벨" 마커.
// 내 저장 핀(PlaceMarker)과 확실히 구분되도록 더 작고 연하게 그린다.
export default function NearbyLabelMarker({ place, onPress }: Props) {
  return (
    <Marker
      coordinate={{ latitude: place.latitude, longitude: place.longitude }}
      onPress={onPress}
      anchor={{ x: 0.5, y: 0.5 }}
      tracksViewChanges={false}
    >
      <View style={styles.wrap}>
        <View style={styles.dot} />
        <Text style={styles.name} numberOfLines={1}>
          {place.name}
        </Text>
      </View>
    </Marker>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    maxWidth: 96,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#9ca3af',
    borderWidth: 1.5,
    borderColor: '#fff',
  },
  name: {
    marginTop: 1,
    fontSize: 10,
    fontWeight: '600',
    color: '#4b5563',
    backgroundColor: 'rgba(255,255,255,0.75)',
    borderRadius: 4,
    paddingHorizontal: 3,
    overflow: 'hidden',
  },
});
