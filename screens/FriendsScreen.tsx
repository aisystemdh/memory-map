import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import {
  acceptRequest,
  deleteFriendship,
  fetchFriends,
  fetchIncomingRequests,
  fetchOutgoingRequests,
  findUserByInvite,
  getMyInviteCode,
  sendFriendRequest,
  FriendRow,
  FriendUser,
} from '../lib/friends';
import FriendPlacesPanel, { PickedFriendPlace } from './FriendPlacesPanel';

type Props = {
  visible: boolean;
  onClose: () => void;
  // 친구 장소 이름을 누르면 호출 — App이 이 화면을 닫고 지도로 이동시킨다.
  onPickFriendPlace: (picked: PickedFriendPlace) => void;
};

// 하나의 친구 화면. 상단 탭으로 [친구 관리] / [친구가 가본 곳] 내용만 전환한다(모달을 쌓지 않는다).
export default function FriendsScreen({ visible, onClose, onPickFriendPlace }: Props) {
  const [tab, setTab] = useState<'manage' | 'places'>('manage');

  // ----- 친구 관리 상태 -----
  const [inviteCode, setInviteCode] = useState('');
  const [incoming, setIncoming] = useState<FriendRow[]>([]);
  const [outgoing, setOutgoing] = useState<FriendRow[]>([]);
  const [friends, setFriends] = useState<FriendRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchCode, setSearchCode] = useState('');
  const [searching, setSearching] = useState(false);
  const [found, setFound] = useState<FriendUser | null>(null);
  const [searchMsg, setSearchMsg] = useState<string | null>(null);

  // 관계가 바뀔 때마다 호출 — 목록 전체를 다시 조회해 화면을 갱신한다.
  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [inc, out, fr] = await Promise.all([
        fetchIncomingRequests(),
        fetchOutgoingRequests(),
        fetchFriends(),
      ]);
      setIncoming(inc);
      setOutgoing(out);
      setFriends(fr);
    } catch (e) {
      Alert.alert('불러오기 실패', e instanceof Error ? e.message : '오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!visible) return;
    getMyInviteCode()
      .then(setInviteCode)
      .catch(() => {});
    reload();
  }, [visible, reload]);

  async function handleCopy() {
    if (!inviteCode) return;
    await Clipboard.setStringAsync(inviteCode);
    Alert.alert('복사됨', '초대코드를 복사했어요.');
  }

  async function handleSearch() {
    const code = searchCode.trim();
    if (!code) return;
    setSearching(true);
    setFound(null);
    setSearchMsg(null);
    try {
      const user = await findUserByInvite(code);
      if (user) setFound(user);
      else setSearchMsg('그 코드의 사용자를 찾지 못했어요.');
    } catch (e) {
      setSearchMsg(e instanceof Error ? e.message : '검색 중 오류가 발생했습니다.');
    } finally {
      setSearching(false);
    }
  }

  async function handleSend() {
    if (!found) return;
    try {
      await sendFriendRequest(found.id);
      setFound(null);
      setSearchCode('');
      setSearchMsg('친구 요청을 보냈어요.');
      await reload();
    } catch (e) {
      Alert.alert('요청 실패', e instanceof Error ? e.message : '오류가 발생했습니다.');
    }
  }

  async function handleAccept(id: string) {
    try {
      await acceptRequest(id);
      await reload();
    } catch (e) {
      Alert.alert('수락 실패', e instanceof Error ? e.message : '오류가 발생했습니다.');
    }
  }

  async function handleDelete(id: string, failTitle: string) {
    try {
      await deleteFriendship(id);
      await reload();
    } catch (e) {
      Alert.alert(failTitle, e instanceof Error ? e.message : '오류가 발생했습니다.');
    }
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>친구</Text>
          <TouchableOpacity onPress={onClose} hitSlop={10}>
            <Text style={styles.close}>닫기</Text>
          </TouchableOpacity>
        </View>

        {/* 최상위 탭 — 내용만 전환 (새 모달 안 띄움) */}
        <View style={styles.tabRow}>
          <TouchableOpacity
            style={[styles.tab, tab === 'manage' && styles.tabOn]}
            onPress={() => setTab('manage')}
          >
            <Text style={[styles.tabText, tab === 'manage' && styles.tabTextOn]}>친구 관리</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, tab === 'places' && styles.tabOn]}
            onPress={() => setTab('places')}
          >
            <Text style={[styles.tabText, tab === 'places' && styles.tabTextOn]}>친구가 가본 곳</Text>
          </TouchableOpacity>
        </View>

        {tab === 'places' ? (
          <FriendPlacesPanel active={visible && tab === 'places'} onPickFriendPlace={onPickFriendPlace} />
        ) : (
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
            {/* 내 초대코드 */}
            <Text style={styles.sectionLabel}>내 초대코드</Text>
            <View style={styles.codeRow}>
              <Text style={styles.code}>{inviteCode || '...'}</Text>
              <TouchableOpacity style={styles.copyButton} onPress={handleCopy}>
                <Text style={styles.copyText}>복사</Text>
              </TouchableOpacity>
            </View>

            {/* 친구 추가 */}
            <Text style={styles.sectionLabel}>친구 추가</Text>
            <View style={styles.searchRow}>
              <TextInput
                style={styles.input}
                placeholder="친구 초대코드 입력"
                value={searchCode}
                onChangeText={setSearchCode}
                autoCapitalize="characters"
                autoCorrect={false}
              />
              <TouchableOpacity style={styles.searchButton} onPress={handleSearch} disabled={searching}>
                {searching ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.searchButtonText}>찾기</Text>
                )}
              </TouchableOpacity>
            </View>
            {found && (
              <View style={styles.foundRow}>
                <Text style={styles.foundName}>{found.nickname}</Text>
                <TouchableOpacity style={styles.sendButton} onPress={handleSend}>
                  <Text style={styles.sendText}>친구 요청</Text>
                </TouchableOpacity>
              </View>
            )}
            {searchMsg && <Text style={styles.searchMsg}>{searchMsg}</Text>}

            {/* 받은 요청 */}
            <Text style={styles.sectionLabel}>받은 요청</Text>
            {incoming.length === 0 ? (
              <Text style={styles.empty}>받은 요청이 없어요.</Text>
            ) : (
              incoming.map((r) => (
                <View key={r.id} style={styles.row}>
                  <Text style={styles.rowName}>{r.user.nickname}</Text>
                  <View style={styles.rowActions}>
                    <TouchableOpacity style={styles.acceptBtn} onPress={() => handleAccept(r.id)}>
                      <Text style={styles.acceptText}>수락</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.rejectBtn}
                      onPress={() => handleDelete(r.id, '거절 실패')}
                    >
                      <Text style={styles.rejectText}>거절</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}

            {/* 보낸 요청 */}
            <Text style={styles.sectionLabel}>보낸 요청</Text>
            {outgoing.length === 0 ? (
              <Text style={styles.empty}>보낸 요청이 없어요.</Text>
            ) : (
              outgoing.map((r) => (
                <View key={r.id} style={styles.row}>
                  <Text style={styles.rowName}>{r.user.nickname}</Text>
                  <TouchableOpacity
                    style={styles.rejectBtn}
                    onPress={() => handleDelete(r.id, '취소 실패')}
                  >
                    <Text style={styles.rejectText}>취소</Text>
                  </TouchableOpacity>
                </View>
              ))
            )}

            {/* 친구 목록 */}
            <Text style={styles.sectionLabel}>내 친구</Text>
            {loading && friends.length === 0 ? (
              <ActivityIndicator style={{ marginTop: 8 }} />
            ) : friends.length === 0 ? (
              <Text style={styles.empty}>아직 친구가 없어요.</Text>
            ) : (
              friends.map((f) => (
                <View key={f.id} style={styles.row}>
                  <Text style={styles.rowName}>{f.user.nickname}</Text>
                  <TouchableOpacity
                    style={styles.rejectBtn}
                    onPress={() =>
                      Alert.alert('친구 끊기', `${f.user.nickname}님과 친구를 끊을까요?`, [
                        { text: '취소', style: 'cancel' },
                        {
                          text: '끊기',
                          style: 'destructive',
                          onPress: () => handleDelete(f.id, '끊기 실패'),
                        },
                      ])
                    }
                  >
                    <Text style={styles.rejectText}>끊기</Text>
                  </TouchableOpacity>
                </View>
              ))
            )}
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', paddingTop: 56 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  title: { fontSize: 22, fontWeight: '700', color: '#111827' },
  close: { fontSize: 16, fontWeight: '600', color: '#2563eb' },
  tabRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 20, marginBottom: 8 },
  tab: { flex: 1, backgroundColor: '#f3f4f6', borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  tabOn: { backgroundColor: '#dbeafe', borderWidth: 1.5, borderColor: '#2563eb' },
  tabText: { fontSize: 14, fontWeight: '600', color: '#6b7280' },
  tabTextOn: { color: '#1d4ed8' },
  scroll: { paddingHorizontal: 20, paddingBottom: 40 },
  sectionLabel: { fontSize: 14, fontWeight: '700', color: '#374151', marginTop: 22, marginBottom: 8 },
  codeRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  code: {
    flex: 1,
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: 2,
    color: '#111827',
    backgroundColor: '#f3f4f6',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  copyButton: { backgroundColor: '#2563eb', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 12 },
  copyText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  searchRow: { flexDirection: 'row', gap: 10 },
  input: {
    flex: 1,
    backgroundColor: '#f3f4f6',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  searchButton: { backgroundColor: '#2563eb', borderRadius: 10, paddingHorizontal: 18, justifyContent: 'center' },
  searchButtonText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  foundRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
    backgroundColor: '#eff6ff',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  foundName: { fontSize: 16, fontWeight: '600', color: '#111827' },
  sendButton: { backgroundColor: '#2563eb', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  sendText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  searchMsg: { fontSize: 14, color: '#6b7280', marginTop: 8 },
  empty: { fontSize: 14, color: '#9ca3af', marginTop: 4 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  rowName: { fontSize: 16, color: '#111827', fontWeight: '600' },
  rowActions: { flexDirection: 'row', gap: 8 },
  acceptBtn: { backgroundColor: '#16a34a', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  acceptText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  rejectBtn: { backgroundColor: '#f3f4f6', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  rejectText: { color: '#374151', fontSize: 14, fontWeight: '600' },
});
