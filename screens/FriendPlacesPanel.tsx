import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  fetchFriendCategories,
  fetchFriendPlaces,
  fetchFriends,
  FriendPlace,
  FriendRow,
  FriendUser,
} from '../lib/friends';

// 친구 장소를 지도에서 보여달라는 요청 (이름 클릭). 카테고리 이름·색도 함께 넘긴다.
export type PickedFriendPlace = {
  place: FriendPlace;
  friendNickname: string;
  categoryName: string;
  categoryColor: string;
};

type Props = {
  // 이 패널이 보이는 탭일 때 true (활성화되면 친구 목록을 새로 로드)
  active: boolean;
  // 친구 장소 이름을 누르면 호출 — App이 친구 화면을 닫고 지도로 이동시킨다.
  onPickFriendPlace: (picked: PickedFriendPlace) => void;
};

// 카테고리별로 묶은 친구의 공개 장소 그룹
type Group = {
  key: string;
  name: string;
  color: string;
  places: FriendPlace[];
};

export default function FriendPlacesPanel({ active, onPickFriendPlace }: Props) {
  // 하위 탭: 친구가 가본 곳 / 다른 사람들이 간 곳(준비 중)
  const [sub, setSub] = useState<'friends' | 'others'>('friends');
  const [friends, setFriends] = useState<FriendRow[]>([]);
  const [selected, setSelected] = useState<FriendUser | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(false);
  // 한마디가 펼쳐진 장소 id
  const [openNoteId, setOpenNoteId] = useState<string | null>(null);

  // 탭이 활성화될 때마다 친구 목록을 새로 불러온다(끊긴 친구가 즉시 사라지도록).
  // 보던 친구가 더는 친구가 아니면 선택을 해제한다.
  useEffect(() => {
    if (!active) return;
    fetchFriends()
      .then((fr) => {
        setFriends(fr);
        setSelected((prev) => {
          if (prev && !fr.some((f) => f.user.id === prev.id)) {
            setGroups([]);
            return null;
          }
          return prev;
        });
      })
      .catch(() => {});
  }, [active]);

  async function selectFriend(user: FriendUser) {
    setSelected(user);
    setGroups([]);
    setOpenNoteId(null);
    setLoading(true);
    try {
      const [places, categories] = await Promise.all([
        fetchFriendPlaces(user.id),
        fetchFriendCategories(user.id),
      ]);
      const catById = new Map(categories.map((c) => [c.id, c]));
      // 공개 장소에 실제로 등장하는 category_id만 그룹으로 → 빈 카테고리는 원천 차단.
      const byCat = new Map<string | null, FriendPlace[]>();
      for (const p of places) {
        const k = p.category_id;
        if (!byCat.has(k)) byCat.set(k, []);
        byCat.get(k)!.push(p);
      }
      const result: Group[] = [];
      for (const [k, ps] of byCat) {
        if (k === null) {
          result.push({ key: 'none', name: '분류 없음', color: '#9ca3af', places: ps });
        } else {
          const c = catById.get(k);
          result.push({ key: k, name: c?.name ?? '기타', color: c?.color ?? '#9ca3af', places: ps });
        }
      }
      setGroups(result);
    } catch (e) {
      // 조회 실패해도 화면 유지
    } finally {
      setLoading(false);
    }
  }

  function backToList() {
    setSelected(null);
    setGroups([]);
    setOpenNoteId(null);
  }

  return (
    <View style={styles.container}>
      {/* 하위 탭 */}
      <View style={styles.subRow}>
        <TouchableOpacity
          style={[styles.subTab, sub === 'friends' && styles.subTabOn]}
          onPress={() => setSub('friends')}
        >
          <Text style={[styles.subText, sub === 'friends' && styles.subTextOn]}>친구가 가본 곳</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.subTab, sub === 'others' && styles.subTabOn]}
          onPress={() => setSub('others')}
        >
          <Text style={[styles.subText, sub === 'others' && styles.subTextOn]}>다른 사람들이 간 곳</Text>
        </TouchableOpacity>
      </View>

      {sub === 'others' ? (
        <View style={styles.placeholder}>
          <Text style={styles.placeholderText}>준비 중</Text>
        </View>
      ) : selected ? (
        <ScrollView contentContainerStyle={styles.scroll}>
          <TouchableOpacity onPress={backToList} style={styles.backRow}>
            <Text style={styles.backText}>← 친구 목록</Text>
          </TouchableOpacity>
          <Text style={styles.friendTitle}>{selected.nickname}님이 공개한 곳</Text>

          {loading ? (
            <ActivityIndicator style={{ marginTop: 16 }} />
          ) : groups.length === 0 ? (
            <Text style={styles.empty}>공개한 장소가 없어요.</Text>
          ) : (
            groups.map((g) => (
              <View key={g.key} style={styles.group}>
                <View style={styles.groupHeader}>
                  <View style={[styles.dot, { backgroundColor: g.color }]} />
                  <Text style={styles.groupName}>{g.name}</Text>
                </View>
                {g.places.map((p) => (
                  <View key={p.id} style={styles.placeItem}>
                    {/* 이름을 누르면 지도로 이동 */}
                    <TouchableOpacity
                      onPress={() =>
                        onPickFriendPlace({
                          place: p,
                          friendNickname: selected.nickname,
                          categoryName: g.name,
                          categoryColor: g.color,
                        })
                      }
                    >
                      <Text style={styles.placeName}>{p.name}</Text>
                    </TouchableOpacity>
                    {/* 친구의 한마디 — friend_note 있을 때만 접기/펼치기 */}
                    {p.friend_note ? (
                      <>
                        <TouchableOpacity
                          onPress={() => setOpenNoteId((cur) => (cur === p.id ? null : p.id))}
                        >
                          <Text style={styles.noteToggle}>
                            친구의 한마디 {openNoteId === p.id ? '▲' : '▼'}
                          </Text>
                        </TouchableOpacity>
                        {openNoteId === p.id && <Text style={styles.noteText}>{p.friend_note}</Text>}
                      </>
                    ) : null}
                  </View>
                ))}
              </View>
            ))
          )}
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll}>
          {friends.length === 0 ? (
            <Text style={styles.empty}>아직 친구가 없어요. 친구를 추가해 보세요.</Text>
          ) : (
            friends.map((f) => (
              <TouchableOpacity
                key={f.id}
                style={styles.friendRow}
                onPress={() => selectFriend(f.user)}
              >
                <Text style={styles.friendRowName}>{f.user.nickname}</Text>
                <Text style={styles.friendRowArrow}>›</Text>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  subRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 20, marginBottom: 8 },
  subTab: { flex: 1, backgroundColor: '#f3f4f6', borderRadius: 10, paddingVertical: 9, alignItems: 'center' },
  subTabOn: { backgroundColor: '#dbeafe', borderWidth: 1.5, borderColor: '#2563eb' },
  subText: { fontSize: 13, fontWeight: '600', color: '#6b7280' },
  subTextOn: { color: '#1d4ed8' },
  scroll: { paddingHorizontal: 20, paddingBottom: 40 },
  placeholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  placeholderText: { fontSize: 16, color: '#9ca3af' },
  empty: { fontSize: 14, color: '#9ca3af', marginTop: 16 },
  friendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  friendRowName: { fontSize: 17, fontWeight: '600', color: '#111827' },
  friendRowArrow: { fontSize: 22, color: '#9ca3af' },
  backRow: { paddingVertical: 8 },
  backText: { fontSize: 15, fontWeight: '600', color: '#2563eb' },
  friendTitle: { fontSize: 18, fontWeight: '700', color: '#111827', marginTop: 4, marginBottom: 8 },
  group: { marginTop: 18 },
  groupHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  dot: { width: 14, height: 14, borderRadius: 7, marginRight: 8 },
  groupName: { fontSize: 16, fontWeight: '700', color: '#374151' },
  placeItem: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  placeName: { fontSize: 16, color: '#111827', fontWeight: '600' },
  noteToggle: { fontSize: 13, color: '#2563eb', fontWeight: '600', marginTop: 6 },
  noteText: { fontSize: 14, color: '#374151', marginTop: 6, lineHeight: 20 },
});
