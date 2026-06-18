import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { KakaoPlace, searchPlaces } from '../lib/kakao';
import { addImportedPlaces, Place } from '../lib/places';
import { createRoute, RouteItemInput, RouteKind } from '../lib/sharedRoutes';

// 빌더를 열 때 넘기는 초기값. 새로 만들기면 빈 items, 리믹스면 기존 items가 채워진다.
export type BuilderInit = {
  kind: RouteKind;
  title: string;
  description: string;
  items: RouteItemInput[];
  lockKind?: boolean; // 리믹스(완주 공유)처럼 종류 고정이 필요할 때
};

type Props = {
  visible: boolean;
  init: BuilderInit | null;
  onClose: () => void;
  onSaved: () => void; // 저장 후 루트 목록 새로고침
  onAlsoAddedToMap: (places: Place[]) => void; // "내 가볼 곳에도 추가" 결과를 지도에 반영
};

function toItem(k: KakaoPlace): RouteItemInput {
  return {
    name: k.name,
    latitude: k.latitude,
    longitude: k.longitude,
    address: k.address || null,
    kakao_place_id: k.id || null,
  };
}

// 처음부터 루트를 만드는 화면(STEP 3). 장소 검색 → 여러 개 추가 → ▲▼로 순서 정렬 → 제목 → 저장.
// 리믹스(가져온 루트 변형 재공유)·완주 후 "내 버전으로 공유"에도 같은 화면을 재사용한다.
// (드래그 정렬은 reanimated가 Expo Go에서 불안정해 ▲▼ 버튼으로 한다 — 진짜 드래그는 dev build 필요)
export default function RouteBuilderModal({
  visible,
  init,
  onClose,
  onSaved,
  onAlsoAddedToMap,
}: Props) {
  const [kind, setKind] = useState<RouteKind>('visited');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [items, setItems] = useState<RouteItemInput[]>([]);
  const [alsoAddToMap, setAlsoAddToMap] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<KakaoPlace[]>([]);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);

  // 열릴 때 초기값으로 리셋
  useEffect(() => {
    if (visible && init) {
      setKind(init.kind);
      setTitle(init.title);
      setDescription(init.description);
      setItems(init.items);
      setAlsoAddToMap(false);
      setQuery('');
      setResults([]);
    }
  }, [visible, init]);

  async function handleSearch() {
    if (!query.trim()) return;
    setSearching(true);
    try {
      setResults(await searchPlaces(query));
    } catch (e) {
      Alert.alert('검색 실패', e instanceof Error ? e.message : '오류가 발생했습니다.');
    } finally {
      setSearching(false);
    }
  }

  function addPlace(k: KakaoPlace) {
    if (k.id && items.some((it) => it.kakao_place_id === k.id)) {
      Alert.alert('이미 담음', '이미 이 루트에 넣은 장소예요.');
      return;
    }
    setItems((prev) => [...prev, toItem(k)]);
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  // 순서 바꾸기 — 위/아래로 한 칸 이동
  function move(index: number, delta: number) {
    setItems((prev) => {
      const next = index + delta;
      if (next < 0 || next >= prev.length) return prev;
      const copy = prev.slice();
      const [moved] = copy.splice(index, 1);
      copy.splice(next, 0, moved);
      return copy;
    });
  }

  async function handleSave() {
    if (!title.trim()) {
      Alert.alert('제목 필요', '루트 제목을 입력해 주세요.');
      return;
    }
    if (items.length < 2) {
      Alert.alert('장소 부족', '루트에는 장소를 2곳 이상 넣어야 해요.');
      return;
    }
    setSaving(true);
    try {
      await createRoute(title.trim(), description.trim() || null, kind, items);
      if (kind === 'want' && alsoAddToMap) {
        const added = await addImportedPlaces(items, null, `내 루트: ${title.trim()}`);
        if (added.length > 0) onAlsoAddedToMap(added);
      }
      onSaved();
      onClose();
      Alert.alert('저장됨', '루트를 저장했어요. 친구가 [친구 루트]에서 가져갈 수 있어요.');
    } catch (e) {
      Alert.alert('저장 실패', e instanceof Error ? e.message : '오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.title}>루트 만들기</Text>
            <TouchableOpacity onPress={onClose} hitSlop={10} disabled={saving}>
              <Text style={styles.close}>닫기</Text>
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
            {/* 루트 종류 */}
            <Text style={styles.label}>루트 종류</Text>
            <View style={styles.kindRow}>
              <TouchableOpacity
                style={[styles.kindBtn, kind === 'visited' && styles.kindOn]}
                onPress={() => !init?.lockKind && setKind('visited')}
                disabled={init?.lockKind}
              >
                <Text style={[styles.kindText, kind === 'visited' && styles.kindTextOn]}>
                  가본 루트
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.kindBtn, kind === 'want' && styles.kindOn]}
                onPress={() => !init?.lockKind && setKind('want')}
                disabled={init?.lockKind}
              >
                <Text style={[styles.kindText, kind === 'want' && styles.kindTextOn]}>
                  가볼 루트
                </Text>
              </TouchableOpacity>
            </View>

            {/* 장소 검색 */}
            <Text style={styles.label}>장소 추가</Text>
            <View style={styles.searchRow}>
              <TextInput
                style={styles.input}
                placeholder="장소 검색 (예: 성수 카페)"
                value={query}
                onChangeText={setQuery}
                onSubmitEditing={handleSearch}
                returnKeyType="search"
              />
              <TouchableOpacity style={styles.searchBtn} onPress={handleSearch} disabled={searching}>
                {searching ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.searchBtnText}>검색</Text>
                )}
              </TouchableOpacity>
            </View>
            {results.map((r) => (
              <TouchableOpacity key={r.id} style={styles.resultRow} onPress={() => addPlace(r)}>
                <View style={styles.flex}>
                  <Text style={styles.resultName}>{r.name}</Text>
                  <Text style={styles.resultAddr} numberOfLines={1}>
                    {r.address}
                  </Text>
                </View>
                <Text style={styles.addPlus}>＋</Text>
              </TouchableOpacity>
            ))}

            {/* 담은 장소 (▲▼로 순서 정렬) */}
            <Text style={styles.label}>루트 순서 ({items.length}곳)</Text>
            {items.length === 0 ? (
              <Text style={styles.empty}>위에서 장소를 검색해 추가하세요.</Text>
            ) : (
              items.map((it, i) => (
                <View key={`${it.kakao_place_id ?? 'x'}-${i}`} style={styles.orderRow}>
                  <Text style={styles.orderNum}>{i + 1}</Text>
                  <Text style={styles.orderName} numberOfLines={1}>
                    {it.name}
                  </Text>
                  <View style={styles.orderActions}>
                    <TouchableOpacity onPress={() => move(i, -1)} hitSlop={6} disabled={i === 0}>
                      <Text style={[styles.arrow, i === 0 && styles.arrowOff]}>▲</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => move(i, 1)}
                      hitSlop={6}
                      disabled={i === items.length - 1}
                    >
                      <Text style={[styles.arrow, i === items.length - 1 && styles.arrowOff]}>
                        ▼
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => removeItem(i)} hitSlop={6}>
                      <Text style={styles.removeX}>✕</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}

            {/* 제목·설명 */}
            <Text style={styles.label}>제목</Text>
            <TextInput
              style={styles.input}
              placeholder="예: 주말 성수 코스"
              value={title}
              onChangeText={setTitle}
              maxLength={40}
            />
            <Text style={styles.label}>설명 (선택)</Text>
            <TextInput
              style={[styles.input, styles.multiline]}
              placeholder="루트 소개"
              value={description}
              onChangeText={setDescription}
              maxLength={200}
              multiline
            />

            {/* 가볼 루트일 때만: 내 가볼 곳에도 추가 */}
            {kind === 'want' && (
              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>내 가볼 곳에도 추가</Text>
                <Switch value={alsoAddToMap} onValueChange={setAlsoAddToMap} />
              </View>
            )}

            <TouchableOpacity
              style={[styles.saveBtn, saving && styles.saveOff]}
              onPress={handleSave}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.saveText}>루트 저장</Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
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
  scroll: { paddingHorizontal: 20, paddingBottom: 60 },
  label: { fontSize: 14, fontWeight: '700', color: '#374151', marginTop: 20, marginBottom: 8 },
  kindRow: { flexDirection: 'row', gap: 8 },
  kindBtn: {
    flex: 1,
    backgroundColor: '#f3f4f6',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  kindOn: { backgroundColor: '#dbeafe', borderWidth: 1.5, borderColor: '#2563eb' },
  kindText: { fontSize: 15, fontWeight: '600', color: '#6b7280' },
  kindTextOn: { color: '#1d4ed8' },
  searchRow: { flexDirection: 'row', gap: 8 },
  input: {
    flex: 1,
    backgroundColor: '#f3f4f6',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  multiline: { minHeight: 64, textAlignVertical: 'top' },
  searchBtn: {
    backgroundColor: '#2563eb',
    borderRadius: 10,
    paddingHorizontal: 18,
    justifyContent: 'center',
  },
  searchBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e7eb',
  },
  resultName: { fontSize: 15, fontWeight: '600', color: '#111827' },
  resultAddr: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  addPlus: { fontSize: 24, color: '#2563eb', fontWeight: '700', paddingHorizontal: 8 },
  empty: { fontSize: 14, color: '#9ca3af' },
  orderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
  },
  orderNum: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#2563eb',
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 24,
    marginRight: 10,
  },
  orderName: { flex: 1, fontSize: 15, color: '#111827', fontWeight: '600' },
  orderActions: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  arrow: { fontSize: 16, color: '#2563eb', fontWeight: '700' },
  arrowOff: { color: '#cbd5e1' },
  removeX: { fontSize: 16, color: '#ef4444', fontWeight: '700' },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 18,
  },
  switchLabel: { fontSize: 15, fontWeight: '600', color: '#374151' },
  saveBtn: {
    backgroundColor: '#0891b2',
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 26,
  },
  saveOff: { backgroundColor: '#a5b4c3' },
  saveText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
