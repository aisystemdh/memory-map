import { useState } from 'react';
import {
  Alert,
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
import { Category } from '../lib/categories';

// 추천 팔레트 8색
const PALETTE = [
  '#ef4444', // 빨강
  '#f97316', // 주황
  '#eab308', // 노랑
  '#22c55e', // 초록
  '#06b6d4', // 청록
  '#3b82f6', // 파랑
  '#8b5cf6', // 보라
  '#ec4899', // 분홍
];

type Props = {
  visible: boolean;
  categories: Category[];
  // 성공 여부를 돌려받아 입력칸 초기화 여부를 정한다.
  onAdd: (name: string, color: string) => Promise<boolean>;
  onRemove: (id: string) => void;
  onClose: () => void;
};

export default function CategoryModal({ visible, categories, onAdd, onRemove, onClose }: Props) {
  const [name, setName] = useState('');
  const [color, setColor] = useState(PALETTE[0]);
  const [adding, setAdding] = useState(false);

  async function handleAdd() {
    const trimmed = name.trim();
    if (!trimmed) {
      Alert.alert('카테고리', '이름을 입력해 주세요.');
      return;
    }
    setAdding(true);
    const ok = await onAdd(trimmed, color);
    setAdding(false);
    if (ok) setName('');
  }

  function handleRemove(category: Category) {
    Alert.alert(
      '카테고리 삭제',
      `'${category.name}'을(를) 삭제할까요?\n이 분류의 장소는 사라지지 않고 분류만 해제됩니다.`,
      [
        { text: '취소', style: 'cancel' },
        { text: '삭제', style: 'destructive', onPress: () => onRemove(category.id) },
      ]
    );
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      {/* 키보드가 올라오면 시트를 그만큼 위로 밀어 입력칸이 가려지지 않게 한다 */}
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>카테고리 관리</Text>
            <TouchableOpacity onPress={onClose} hitSlop={10}>
              <Text style={styles.close}>✕</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.label}>새 카테고리</Text>
          <TextInput
            style={styles.nameInput}
            placeholder="이름 (예: 카페, 맛집)"
            value={name}
            onChangeText={setName}
            maxLength={20}
          />

          <View style={styles.paletteRow}>
            {PALETTE.map((c) => (
              <TouchableOpacity
                key={c}
                style={[styles.swatch, { backgroundColor: c }, color === c && styles.swatchSelected]}
                onPress={() => setColor(c)}
              />
            ))}
          </View>

          <TouchableOpacity style={styles.addButton} onPress={handleAdd} disabled={adding}>
            <Text style={styles.addButtonText}>{adding ? '추가 중...' : '추가'}</Text>
          </TouchableOpacity>

          <Text style={styles.label}>내 카테고리</Text>
          {categories.length === 0 ? (
            <Text style={styles.empty}>아직 카테고리가 없습니다.</Text>
          ) : (
            <ScrollView style={styles.list}>
              {categories.map((c) => (
                <View key={c.id} style={styles.item}>
                  <View style={[styles.itemDot, { backgroundColor: c.color }]} />
                  <Text style={styles.itemName} numberOfLines={1}>
                    {c.name}
                  </Text>
                  <TouchableOpacity onPress={() => handleRemove(c)} hitSlop={8}>
                    <Text style={styles.itemDelete}>삭제</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
          )}
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
    maxHeight: '80%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  close: {
    fontSize: 16,
    color: '#6b7280',
    paddingHorizontal: 6,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginTop: 18,
    marginBottom: 8,
  },
  nameInput: {
    backgroundColor: '#f3f4f6',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  paletteRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  swatch: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  swatchSelected: {
    borderWidth: 3,
    borderColor: '#111827',
  },
  addButton: {
    backgroundColor: '#2563eb',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 12,
  },
  addButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  empty: {
    fontSize: 14,
    color: '#9ca3af',
  },
  list: {
    maxHeight: 200,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  itemDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    marginRight: 10,
  },
  itemName: {
    flex: 1,
    fontSize: 16,
    color: '#111827',
  },
  itemDelete: {
    fontSize: 14,
    color: '#ef4444',
    fontWeight: '600',
  },
});
