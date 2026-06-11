import DateTimePicker from '@react-native-community/datetimepicker';
import { useEffect, useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { KakaoPlace } from '../lib/kakao';
import { pickPhotos, PickedPhoto } from '../lib/photos';
import { Category, CATEGORY_PALETTE } from '../lib/categories';
import { PlaceStatus } from '../lib/places';

type Props = {
  // 저장할 대상 장소. null이면 모달이 닫힘.
  place: KakaoPlace | null;
  // 상세 카드에서 '찜/기록'으로 고른 상태 — 모달이 열릴 때 기본 선택된다
  initialStatus: PlaceStatus;
  saving: boolean;
  categories: Category[];
  onCancel: () => void;
  onSave: (
    status: PlaceStatus,
    visitedOn: string | null, // 다녀온 곳이면 날짜, 가보고 싶은 곳이면 null
    memo: string,
    photos: PickedPhoto[],
    categoryId: string | null,
    planDate: string | null, // 가보고 싶은 곳의 계획일 (미정이면 null)
    planWith: string | null // 가보고 싶은 곳의 동행 (선택)
  ) => void;
  // 인라인 카테고리 생성 — 만든 카테고리(실패 시 null)를 돌려받아 바로 선택한다
  onCreateCategory: (name: string, color: string) => Promise<Category | null>;
};

// Date 객체를 YYYY-MM-DD 문자열로 (현지 시간 기준)
function toDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export default function SavePlaceModal({
  place,
  initialStatus,
  saving,
  categories,
  onCancel,
  onSave,
  onCreateCategory,
}: Props) {
  const [date, setDate] = useState<Date>(new Date());
  const [memo, setMemo] = useState('');
  const [showPicker, setShowPicker] = useState(Platform.OS === 'ios');
  // 아직 저장 전, 사용자가 고른 사진들 (로컬 미리보기)
  const [photos, setPhotos] = useState<PickedPhoto[]>([]);
  const [picking, setPicking] = useState(false);
  // 선택한 카테고리 (null = 분류 없음)
  const [categoryId, setCategoryId] = useState<string | null>(null);
  // 다녀온 곳 / 가보고 싶은 곳 — 상세 카드에서 고른 상태로 시작
  const [status, setStatus] = useState<PlaceStatus>(initialStatus);
  // 모달이 새 장소로 열릴 때마다 카드에서 고른 상태를 다시 반영
  useEffect(() => {
    if (place) setStatus(initialStatus);
  }, [place, initialStatus]);
  // 가보고 싶은 곳: 언제 갈지 (null = 날짜 미정) / 누구랑 (선택)
  const [planDate, setPlanDate] = useState<Date | null>(null);
  const [planWith, setPlanWith] = useState('');
  const [showPlanPicker, setShowPlanPicker] = useState(false);
  // 인라인 카테고리 생성 폼 (모달을 벗어나지 않고 만든다)
  const [newCatOpen, setNewCatOpen] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatColor, setNewCatColor] = useState(CATEGORY_PALETTE[0]);
  const [newCatCustom, setNewCatCustom] = useState(''); // 직접 입력한 hex (선택)
  const [creatingCat, setCreatingCat] = useState(false);

  // 다음 저장을 위해 입력값 초기화
  function reset() {
    setMemo('');
    setDate(new Date());
    setShowPicker(Platform.OS === 'ios');
    setPhotos([]);
    setCategoryId(null);
    setStatus('visited');
    setPlanDate(null);
    setPlanWith('');
    setShowPlanPicker(false);
    resetNewCategory();
  }

  function resetNewCategory() {
    setNewCatOpen(false);
    setNewCatName('');
    setNewCatColor(CATEGORY_PALETTE[0]);
    setNewCatCustom('');
  }

  // 인라인 생성: 성공하면 그 카테고리를 이 장소에 바로 선택한다
  async function handleCreateCategory() {
    const name = newCatName.trim();
    if (!name) {
      Alert.alert('카테고리', '이름을 입력해 주세요.');
      return;
    }
    // 직접 입력한 색이 있으면 그 색을, 아니면 팔레트에서 고른 색을 쓴다
    let color = newCatColor;
    const custom = newCatCustom.trim().replace(/^#/, '');
    if (custom) {
      if (!/^[0-9a-fA-F]{6}$/.test(custom)) {
        Alert.alert('카테고리', '직접 입력 색은 6자리 hex로 적어 주세요. (예: 1d4ed8)');
        return;
      }
      color = `#${custom.toLowerCase()}`;
    }
    setCreatingCat(true);
    const created = await onCreateCategory(name, color);
    setCreatingCat(false);
    if (created) {
      setCategoryId(created.id);
      resetNewCategory();
    }
  }

  function handleSave() {
    // 가보고 싶은 곳: 방문 날짜·메모 없음(메모는 체크인 때), 대신 계획일·동행을 저장
    onSave(
      status,
      status === 'visited' ? toDateString(date) : null,
      status === 'visited' ? memo.trim() : '',
      photos,
      categoryId,
      status === 'want' && planDate ? toDateString(planDate) : null,
      status === 'want' ? planWith.trim() || null : null
    );
    reset();
  }

  // 취소 시에도 고른 사진을 비워 다음 장소에 섞이지 않게 한다.
  function handleCancel() {
    reset();
    onCancel();
  }

  // 사진첩에서 골라 미리보기 목록에 추가
  async function handlePickPhotos() {
    setPicking(true);
    try {
      const picked = await pickPhotos();
      if (picked.length > 0) setPhotos((prev) => [...prev, ...picked]);
    } finally {
      setPicking(false);
    }
  }

  return (
    <Modal
      visible={place !== null}
      transparent
      animationType="slide"
      onRequestClose={handleCancel}
    >
      {/* 키보드가 올라오면 시트를 그만큼 위로 밀어 입력칸이 가려지지 않게 한다 */}
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.sheet}>
          <Text style={styles.title}>{place?.name}</Text>
          {place?.address ? (
            <Text style={styles.address}>{place.address}</Text>
          ) : null}

          <Text style={styles.label}>상태</Text>
          <View style={styles.statusRow}>
            <TouchableOpacity
              style={[styles.statusButton, status === 'visited' && styles.statusButtonSelected]}
              onPress={() => setStatus('visited')}
            >
              <Text
                style={[styles.statusText, status === 'visited' && styles.statusTextSelected]}
              >
                다녀온 곳
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.statusButton, status === 'want' && styles.statusButtonSelected]}
              onPress={() => setStatus('want')}
            >
              <Text style={[styles.statusText, status === 'want' && styles.statusTextSelected]}>
                가보고 싶은 곳
              </Text>
            </TouchableOpacity>
          </View>

          {/* 방문 날짜는 '다녀온 곳'일 때만 입력 */}
          {status === 'visited' && (
            <>
              <Text style={styles.label}>날짜</Text>
              {Platform.OS === 'android' && (
                <TouchableOpacity
                  style={styles.dateButton}
                  onPress={() => setShowPicker(true)}
                >
                  <Text style={styles.dateButtonText}>{toDateString(date)}</Text>
                </TouchableOpacity>
              )}
              {showPicker && (
                <DateTimePicker
                  value={date}
                  mode="date"
                  display="default"
                  maximumDate={new Date()}
                  onChange={(event, selected) => {
                    if (Platform.OS === 'android') setShowPicker(false);
                    if (event.type === 'set' && selected) setDate(selected);
                  }}
                />
              )}
            </>
          )}

          {/* 가보고 싶은 곳: 계획일(미정 가능)과 동행을 입력 */}
          {status === 'want' && (
            <>
              <Text style={styles.label}>언제 갈지 (선택)</Text>
              <View style={styles.planDateRow}>
                <TouchableOpacity
                  style={styles.dateButton}
                  onPress={() => setShowPlanPicker(true)}
                >
                  <Text style={styles.dateButtonText}>
                    {planDate ? toDateString(planDate) : '날짜 미정'}
                  </Text>
                </TouchableOpacity>
                {planDate && (
                  <TouchableOpacity
                    style={styles.planClearButton}
                    onPress={() => {
                      setPlanDate(null);
                      setShowPlanPicker(false);
                    }}
                  >
                    <Text style={styles.planClearText}>미정으로</Text>
                  </TouchableOpacity>
                )}
              </View>
              {showPlanPicker && (
                <DateTimePicker
                  value={planDate ?? new Date()}
                  mode="date"
                  display="default"
                  onChange={(event, selected) => {
                    if (Platform.OS === 'android') setShowPlanPicker(false);
                    if (event.type === 'set' && selected) setPlanDate(selected);
                  }}
                />
              )}

              <Text style={styles.label}>누구랑 (선택)</Text>
              <TextInput
                style={styles.memoInput}
                placeholder="같이 갈 사람을 적어보세요"
                value={planWith}
                onChangeText={setPlanWith}
                maxLength={50}
              />
            </>
          )}

          {/* 메모는 '다녀온 곳'일 때만 — 가보고 싶은 곳은 체크인하는 순간에 묻는다 */}
          {status === 'visited' && (
            <>
              <Text style={styles.label}>한 줄 메모</Text>
              <TextInput
                style={styles.memoInput}
                placeholder="그날의 추억을 한 줄로 남겨보세요"
                value={memo}
                onChangeText={setMemo}
                maxLength={100}
              />
            </>
          )}

          <Text style={styles.label}>카테고리</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <TouchableOpacity
              style={[styles.chip, categoryId === null && styles.chipSelected]}
              onPress={() => setCategoryId(null)}
            >
              <Text style={styles.chipText}>분류 없음</Text>
            </TouchableOpacity>
            {categories.map((c) => (
              <TouchableOpacity
                key={c.id}
                style={[styles.chip, categoryId === c.id && styles.chipSelected]}
                onPress={() => setCategoryId(c.id)}
              >
                <View style={[styles.chipDot, { backgroundColor: c.color }]} />
                <Text style={styles.chipText}>{c.name}</Text>
              </TouchableOpacity>
            ))}
            {/* 모달을 벗어나지 않고 새 카테고리 만들기 */}
            <TouchableOpacity
              style={[styles.chip, styles.newCatChip]}
              onPress={() => setNewCatOpen((open) => !open)}
            >
              <Text style={styles.newCatChipText}>+ 새 카테고리</Text>
            </TouchableOpacity>
          </ScrollView>

          {/* 인라인 카테고리 생성 폼 — 만들면 즉시 이 장소에 선택된다 */}
          {newCatOpen && (
            <View style={styles.newCatForm}>
              <TextInput
                style={styles.newCatInput}
                placeholder="이름 (예: 카페, 맛집)"
                value={newCatName}
                onChangeText={setNewCatName}
                maxLength={20}
              />
              <View style={styles.paletteRow}>
                {CATEGORY_PALETTE.map((c) => (
                  <TouchableOpacity
                    key={c}
                    style={[
                      styles.swatch,
                      { backgroundColor: c },
                      !newCatCustom && newCatColor === c && styles.swatchSelected,
                    ]}
                    onPress={() => {
                      setNewCatColor(c);
                      setNewCatCustom('');
                    }}
                  />
                ))}
              </View>
              <TextInput
                style={styles.newCatInput}
                placeholder="색 직접 입력 (선택, 예: 1d4ed8)"
                value={newCatCustom}
                onChangeText={setNewCatCustom}
                autoCapitalize="none"
                maxLength={7}
              />
              <View style={styles.newCatButtonRow}>
                <TouchableOpacity style={styles.newCatCancel} onPress={resetNewCategory}>
                  <Text style={styles.newCatCancelText}>취소</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.newCatCreate}
                  onPress={handleCreateCategory}
                  disabled={creatingCat}
                >
                  <Text style={styles.newCatCreateText}>
                    {creatingCat ? '만드는 중...' : '만들기'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          <Text style={styles.label}>사진</Text>
          {photos.length > 0 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.thumbRow}
            >
              {photos.map((p, i) => (
                <Image key={i} source={{ uri: p.uri }} style={styles.thumb} />
              ))}
            </ScrollView>
          )}
          <TouchableOpacity
            style={styles.addPhotoButton}
            onPress={handlePickPhotos}
            disabled={picking || saving}
          >
            <Text style={styles.addPhotoText}>
              {picking ? '불러오는 중...' : '+ 사진 추가'}
            </Text>
          </TouchableOpacity>

          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={handleCancel}
              disabled={saving}
            >
              <Text style={styles.cancelText}>취소</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, styles.saveButton]}
              onPress={handleSave}
              disabled={saving}
            >
              <Text style={styles.saveText}>{saving ? '저장 중...' : '저장'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 32,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  address: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 4,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginTop: 18,
    marginBottom: 8,
  },
  statusRow: {
    flexDirection: 'row',
    gap: 10,
  },
  statusButton: {
    flex: 1,
    backgroundColor: '#f3f4f6',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  statusButtonSelected: {
    backgroundColor: '#dbeafe',
    borderWidth: 1.5,
    borderColor: '#2563eb',
  },
  statusText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#6b7280',
  },
  statusTextSelected: {
    color: '#1d4ed8',
  },
  dateButton: {
    backgroundColor: '#f3f4f6',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    alignSelf: 'flex-start',
  },
  dateButtonText: {
    fontSize: 16,
    color: '#111827',
  },
  planDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  planClearButton: {
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  planClearText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
  },
  memoInput: {
    backgroundColor: '#f3f4f6',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8,
  },
  chipSelected: {
    backgroundColor: '#dbeafe',
    borderWidth: 1.5,
    borderColor: '#2563eb',
  },
  chipDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 6,
  },
  chipText: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '600',
  },
  newCatChip: {
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    borderStyle: 'dashed',
  },
  newCatChipText: {
    fontSize: 14,
    color: '#2563eb',
    fontWeight: '600',
  },
  newCatForm: {
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 12,
    marginTop: 10,
  },
  newCatInput: {
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  paletteRow: {
    flexDirection: 'row',
    gap: 8,
    marginVertical: 10,
  },
  swatch: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  swatchSelected: {
    borderWidth: 3,
    borderColor: '#111827',
  },
  newCatButtonRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
  newCatCancel: {
    flex: 1,
    backgroundColor: '#f3f4f6',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  newCatCancelText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  newCatCreate: {
    flex: 1,
    backgroundColor: '#2563eb',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  newCatCreateText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  thumbRow: {
    marginBottom: 4,
  },
  thumb: {
    width: 72,
    height: 72,
    borderRadius: 8,
    marginRight: 8,
    backgroundColor: '#e5e7eb',
  },
  addPhotoButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#eff6ff',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginTop: 8,
  },
  addPhotoText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#2563eb',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  button: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#f3f4f6',
  },
  cancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  saveButton: {
    backgroundColor: '#2563eb',
  },
  saveText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});
