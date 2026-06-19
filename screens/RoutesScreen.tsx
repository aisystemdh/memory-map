import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Place } from '../lib/places';
import RouteBuilderModal, { BuilderInit } from '../components/RouteBuilderModal';
import {
  deleteRoute,
  fetchFriendRoutes,
  fetchMyImports,
  fetchMyRoutes,
  fetchRouteItems,
  unpackImport,
  RouteImport,
  RouteItem,
  RouteKind,
  SharedRoute,
} from '../lib/sharedRoutes';

// 루트 뷰어를 열 때 App에 넘기는 정보. friendRoute가 있으면 친구 루트(가져오기 가능).
export type ViewerPayload = {
  items: RouteItem[];
  kind: RouteKind;
  title: string;
  friendRoute: { id: string; sourceName: string } | null;
};

type Tab = 'mine' | 'friends' | 'imported';

type Props = {
  visible: boolean;
  onClose: () => void;
  onOpenViewer: (payload: ViewerPayload) => void;
  onPlacesAdded: (places: Place[]) => void;
};

// 가본/가볼 종류 뱃지
function KindBadge({ kind }: { kind: RouteKind | null }) {
  if (!kind) return null;
  const visited = kind === 'visited';
  return (
    <View style={[styles.badge, visited ? styles.badgeVisited : styles.badgeWant]}>
      <Text style={[styles.badgeText, visited ? styles.badgeTextVisited : styles.badgeTextWant]}>
        {visited ? '가본' : '가볼'}
      </Text>
    </View>
  );
}

// 저장된 루트를 모아 보는 화면. 상단 탭으로 [내 루트]/[친구 루트]/[가져온 루트] 전환.
export default function RoutesScreen({ visible, onClose, onOpenViewer, onPlacesAdded }: Props) {
  const [tab, setTab] = useState<Tab>('mine');
  const [loading, setLoading] = useState(false);
  const [myRoutes, setMyRoutes] = useState<SharedRoute[]>([]);
  const [friendRoutes, setFriendRoutes] = useState<SharedRoute[]>([]);
  const [imports, setImports] = useState<RouteImport[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [builderInit, setBuilderInit] = useState<BuilderInit | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      if (tab === 'mine') setMyRoutes(await fetchMyRoutes());
      else if (tab === 'friends') setFriendRoutes(await fetchFriendRoutes());
      else setImports(await fetchMyImports());
    } catch (e) {
      Alert.alert('불러오기 실패', e instanceof Error ? e.message : '오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => {
    if (!visible) return;
    reload();
  }, [visible, reload]);

  async function openViewer(route: SharedRoute, friendRoute: ViewerPayload['friendRoute']) {
    try {
      const items = await fetchRouteItems(route.id);
      if (items.length === 0) {
        Alert.alert('빈 루트', '이 루트에는 장소가 없어요.');
        return;
      }
      onOpenViewer({ items, kind: route.kind, title: route.title, friendRoute });
    } catch (e) {
      Alert.alert('루트 열기 실패', e instanceof Error ? e.message : '오류가 발생했습니다.');
    }
  }

  function confirmDelete(route: SharedRoute) {
    Alert.alert('루트 삭제', `'${route.title}' 루트를 삭제할까요?`, [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteRoute(route.id);
            setMyRoutes((prev) => prev.filter((r) => r.id !== route.id));
          } catch (e) {
            Alert.alert('삭제 실패', e instanceof Error ? e.message : '오류가 발생했습니다.');
          }
        },
      },
    ]);
  }

  // STEP 6: 풀기 결과 {added, merged}를 반영. merged는 이미 있던 장소에 출처만 누적된 수.
  async function handleUnpack(imp: RouteImport) {
    setBusyId(imp.id);
    try {
      const { added, merged } = await unpackImport(imp);
      if (added.length === 0 && merged === 0) {
        Alert.alert('이미 추가됨', '이 루트는 이미 내 지도에 추가했어요.');
      } else {
        if (added.length > 0) onPlacesAdded(added);
        const mergeMsg = merged > 0 ? ` (이미 있던 ${merged}곳은 출처만 더했어요)` : '';
        Alert.alert('추가됨', `가볼 곳 ${added.length}곳을 내 지도에 담았어요.${mergeMsg}`);
      }
      await reload();
    } catch (e) {
      Alert.alert('추가 실패', e instanceof Error ? e.message : '오류가 발생했습니다.');
    } finally {
      setBusyId(null);
    }
  }

  // ★7/★8: 가져온 루트를 변형해 내 루트로 재공유(리믹스). 완주면 가본 루트로 기본 설정.
  async function openRemix(imp: RouteImport) {
    setBusyId(imp.id);
    try {
      const items = await fetchRouteItems(imp.route_id);
      setBuilderInit({
        kind: imp.completed ? 'visited' : imp.kind ?? 'want',
        title: `${imp.title} (내 버전)`,
        description: `${imp.source_name}님의 루트를 리믹스`,
        items: items.map((it) => ({
          name: it.name,
          latitude: it.latitude,
          longitude: it.longitude,
          address: it.address,
          kakao_place_id: it.kakao_place_id,
        })),
      });
    } catch (e) {
      Alert.alert('불러오기 실패', e instanceof Error ? e.message : '오류가 발생했습니다.');
    } finally {
      setBusyId(null);
    }
  }

  const myVisited = myRoutes.filter((r) => r.kind === 'visited');
  const myWant = myRoutes.filter((r) => r.kind === 'want');

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>루트</Text>
          <TouchableOpacity onPress={onClose} hitSlop={10}>
            <Text style={styles.close}>닫기</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.tabRow}>
          {(
            [
              ['mine', '내 루트'],
              ['friends', '친구 루트'],
              ['imported', '가져온 루트'],
            ] as [Tab, string][]
          ).map(([key, label]) => (
            <TouchableOpacity
              key={key}
              style={[styles.tab, tab === key && styles.tabOn]}
              onPress={() => setTab(key)}
            >
              <Text style={[styles.tabText, tab === key && styles.tabTextOn]}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {loading ? (
          <ActivityIndicator style={{ marginTop: 24 }} />
        ) : (
          <ScrollView contentContainerStyle={styles.scroll}>
            {/* ---------- 내 루트 ---------- */}
            {tab === 'mine' && (
              <>
                <TouchableOpacity
                  style={styles.createBtn}
                  onPress={() =>
                    setBuilderInit({ kind: 'visited', title: '', description: '', items: [] })
                  }
                >
                  <Text style={styles.createText}>＋ 루트 만들기</Text>
                </TouchableOpacity>

                {myRoutes.length === 0 ? (
                  <Text style={styles.empty}>
                    아직 만든 루트가 없어요. '루트 만들기'로 새로 만들거나, 지도에서 동선을 보다가
                    공유해 보세요.
                  </Text>
                ) : (
                  <>
                    <Text style={styles.sectionLabel}>가본 루트</Text>
                    {myVisited.length === 0 ? (
                      <Text style={styles.empty}>가본 루트가 없어요.</Text>
                    ) : (
                      myVisited.map((r) => (
                        <RouteCard
                          key={r.id}
                          route={r}
                          onOpen={() => openViewer(r, null)}
                          onDelete={() => confirmDelete(r)}
                        />
                      ))
                    )}
                    <Text style={styles.sectionLabel}>가볼 루트</Text>
                    {myWant.length === 0 ? (
                      <Text style={styles.empty}>가볼 루트가 없어요.</Text>
                    ) : (
                      myWant.map((r) => (
                        <RouteCard
                          key={r.id}
                          route={r}
                          onOpen={() => openViewer(r, null)}
                          onDelete={() => confirmDelete(r)}
                        />
                      ))
                    )}
                  </>
                )}
              </>
            )}

            {/* ---------- 친구 루트 ---------- */}
            {tab === 'friends' &&
              (friendRoutes.length === 0 ? (
                <Text style={styles.empty}>친구가 공유한 루트가 아직 없어요.</Text>
              ) : (
                friendRoutes.map((r) => (
                  <RouteCard
                    key={r.id}
                    route={r}
                    showOwner
                    onOpen={() =>
                      openViewer(r, { id: r.id, sourceName: r.owner_nickname || '사용자' })
                    }
                  />
                ))
              ))}

            {/* ---------- 가져온 루트 ---------- */}
            {tab === 'imported' &&
              (imports.length === 0 ? (
                <Text style={styles.empty}>
                  가져온 루트가 없어요. [친구 루트]에서 마음에 드는 루트를 가져오면 여기에 담겨요.
                </Text>
              ) : (
                imports.map((imp) => (
                  <View key={imp.id} style={styles.card}>
                    <View style={styles.cardTopRow}>
                      <Text style={styles.cardTitle} numberOfLines={1}>
                        {imp.title}
                      </Text>
                      <KindBadge kind={imp.kind} />
                    </View>
                    <Text style={styles.cardSub}>출처 · {imp.source_name}</Text>

                    {/* 진행도/완주 (풀린 경우만) */}
                    {imp.unpacked && (
                      <Text style={imp.completed ? styles.doneText : styles.progressText}>
                        {imp.completed
                          ? `완주! ${imp.source_name}님의 코스를 모두 다녀왔어요`
                          : `다녀온 곳 ${imp.visited}/${imp.total}`}
                      </Text>
                    )}

                    <View style={styles.cardBtnRow}>
                      <TouchableOpacity
                        style={[styles.addBtn, imp.unpacked && styles.addedBtn]}
                        onPress={() => handleUnpack(imp)}
                        disabled={imp.unpacked || busyId === imp.id}
                      >
                        {busyId === imp.id ? (
                          <ActivityIndicator color="#fff" />
                        ) : (
                          <Text style={[styles.addText, imp.unpacked && styles.addedText]}>
                            {imp.unpacked ? '추가됨 ✓' : '내 지도에 추가'}
                          </Text>
                        )}
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.remixBtn, imp.completed && styles.remixDone]}
                        onPress={() => openRemix(imp)}
                        disabled={busyId === imp.id}
                      >
                        <Text style={styles.remixText}>
                          {imp.completed ? '내 버전으로 공유' : '리믹스'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))
              ))}
          </ScrollView>
        )}
      </View>

      {/* 루트 만들기 / 리믹스 — 같은 빌더 화면 재사용 */}
      <RouteBuilderModal
        visible={builderInit !== null}
        init={builderInit}
        onClose={() => setBuilderInit(null)}
        onSaved={reload}
        onAlsoAddedToMap={onPlacesAdded}
      />
    </Modal>
  );
}

// 루트 한 장 카드 (내 루트·친구 루트 공용)
function RouteCard({
  route,
  showOwner,
  onOpen,
  onDelete,
}: {
  route: SharedRoute;
  showOwner?: boolean;
  onOpen: () => void;
  onDelete?: () => void;
}) {
  return (
    <TouchableOpacity style={styles.card} onPress={onOpen} activeOpacity={0.7}>
      <View style={styles.cardTopRow}>
        <Text style={styles.cardTitle} numberOfLines={1}>
          {route.title}
        </Text>
        <KindBadge kind={route.kind} />
        {onDelete && (
          <TouchableOpacity onPress={onDelete} hitSlop={8}>
            <Text style={styles.cardDelete}>삭제</Text>
          </TouchableOpacity>
        )}
      </View>
      {showOwner && <Text style={styles.cardSub}>{route.owner_nickname}님의 루트</Text>}
      <Text style={styles.cardMeta}>장소 {route.item_count}곳</Text>
      {/* ★5: 가져가짐 강조 */}
      {route.import_count > 0 ? (
        <Text style={styles.takenText}>🔥 {route.import_count}명이 가져갔어요</Text>
      ) : (
        <Text style={styles.cardMeta}>아직 가져간 사람 없음</Text>
      )}
    </TouchableOpacity>
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
  tab: {
    flex: 1,
    backgroundColor: '#f3f4f6',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  tabOn: { backgroundColor: '#dbeafe', borderWidth: 1.5, borderColor: '#2563eb' },
  tabText: { fontSize: 14, fontWeight: '600', color: '#6b7280' },
  tabTextOn: { color: '#1d4ed8' },
  scroll: { paddingHorizontal: 20, paddingBottom: 40 },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#374151',
    marginTop: 18,
    marginBottom: 8,
  },
  empty: { fontSize: 14, color: '#9ca3af', marginTop: 10, lineHeight: 20 },
  createBtn: {
    backgroundColor: '#0891b2',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 6,
    marginBottom: 6,
  },
  createText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  card: {
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#f3f4f6',
  },
  cardTopRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardTitle: { flex: 1, fontSize: 17, fontWeight: '700', color: '#111827' },
  cardDelete: { fontSize: 14, color: '#ef4444', fontWeight: '600' },
  cardSub: { fontSize: 13, color: '#db2777', fontWeight: '600', marginTop: 4 },
  cardMeta: { fontSize: 13, color: '#6b7280', marginTop: 6 },
  takenText: { fontSize: 13, color: '#ea580c', fontWeight: '700', marginTop: 6 },
  progressText: { fontSize: 13, color: '#2563eb', fontWeight: '600', marginTop: 8 },
  doneText: { fontSize: 14, color: '#16a34a', fontWeight: '700', marginTop: 8 },
  cardBtnRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  addBtn: {
    flex: 2,
    backgroundColor: '#0891b2',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  addedBtn: { backgroundColor: '#f3f4f6' },
  addText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  addedText: { color: '#6b7280' },
  remixBtn: {
    flex: 1,
    backgroundColor: '#7c3aed',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  remixDone: { flex: 2, backgroundColor: '#16a34a' },
  remixText: { fontSize: 14, fontWeight: '700', color: '#fff' },
  badge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  badgeVisited: { backgroundColor: '#dcfce7' },
  badgeWant: { backgroundColor: '#ede9fe' },
  badgeText: { fontSize: 12, fontWeight: '700' },
  badgeTextVisited: { color: '#15803d' },
  badgeTextWant: { color: '#6d28d9' },
});
