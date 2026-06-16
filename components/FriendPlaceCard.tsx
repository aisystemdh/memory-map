import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { PickedFriendPlace } from '../screens/FriendPlacesPanel';

type Props = {
  // 지도에서 보여줄 친구 장소. null이면 카드 숨김.
  picked: PickedFriendPlace | null;
  onClose: () => void;
};

// 친구의 공개 장소를 지도에서 볼 때 띄우는 읽기 전용 카드.
// 내 PlaceCard와 달리 편집·체크인·방문·사진이 전혀 없다. 이름·분류·친구 한마디만.
export default function FriendPlaceCard({ picked, onClose }: Props) {
  if (!picked) return null;
  const { place, friendNickname, categoryName, categoryColor } = picked;

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

      <Text style={styles.owner}>{friendNickname}님이 공개한 곳</Text>

      <View style={styles.categoryChip}>
        <View style={[styles.dot, { backgroundColor: categoryColor }]} />
        <Text style={styles.categoryText}>{categoryName}</Text>
      </View>

      {place.friend_note ? (
        <Text style={styles.note}>{place.friend_note}</Text>
      ) : (
        <Text style={styles.noteEmpty}>친구의 한마디가 없어요.</Text>
      )}
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
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  name: { flex: 1, fontSize: 18, fontWeight: '700', color: '#111827' },
  close: { fontSize: 16, color: '#6b7280', paddingHorizontal: 6 },
  owner: { fontSize: 13, color: '#db2777', fontWeight: '600', marginTop: 4 },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#f3f4f6',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 7,
    marginTop: 10,
  },
  dot: { width: 12, height: 12, borderRadius: 6, marginRight: 6 },
  categoryText: { fontSize: 14, fontWeight: '600', color: '#374151' },
  note: { fontSize: 15, color: '#374151', marginTop: 12, lineHeight: 21 },
  noteEmpty: { fontSize: 14, color: '#9ca3af', marginTop: 12 },
});
