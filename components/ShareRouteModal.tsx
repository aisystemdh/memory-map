import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

type Props = {
  visible: boolean;
  placeCount: number; // 이 동선에 담길 장소 수 (안내용)
  kind: 'visited' | 'want'; // 가본/가볼 동선
  saving: boolean;
  onSubmit: (title: string, description: string) => void;
  onCancel: () => void;
};

// "이 루트 공유하기" → 제목(필수)·설명(선택)을 받는 작은 모달.
// 확인하면 그 순간 routes + route_items가 생성된다(공유=저장).
export default function ShareRouteModal({
  visible,
  placeCount,
  kind,
  saving,
  onSubmit,
  onCancel,
}: Props) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  // 열릴 때마다 입력 초기화
  useEffect(() => {
    if (visible) {
      setTitle('');
      setDescription('');
    }
  }, [visible]);

  const canSave = title.trim().length > 0 && !saving;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.sheet}>
          <Text style={styles.title}>루트 공유하기</Text>
          <Text style={styles.subtitle}>
            {kind === 'visited' ? '다녀온' : '가볼'} 장소 {placeCount}곳을 하나의 루트로 저장해 친구에게
            공유해요.
          </Text>

          <Text style={styles.label}>제목</Text>
          <TextInput
            style={styles.input}
            placeholder="예: 성수동 카페 투어"
            value={title}
            onChangeText={setTitle}
            maxLength={40}
          />

          <Text style={styles.label}>설명 (선택)</Text>
          <TextInput
            style={[styles.input, styles.multiline]}
            placeholder="루트 소개를 적어보세요"
            value={description}
            onChangeText={setDescription}
            maxLength={200}
            multiline
          />

          <View style={styles.actions}>
            <TouchableOpacity style={styles.cancel} onPress={onCancel} disabled={saving}>
              <Text style={styles.cancelText}>취소</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.save, !canSave && styles.saveOff]}
              onPress={() => onSubmit(title.trim(), description.trim())}
              disabled={!canSave}
            >
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.saveText}>공유하기</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 32,
  },
  title: { fontSize: 20, fontWeight: '700', color: '#111827' },
  subtitle: { fontSize: 14, color: '#6b7280', marginTop: 6, lineHeight: 20 },
  label: { fontSize: 14, fontWeight: '700', color: '#374151', marginTop: 18, marginBottom: 8 },
  input: {
    backgroundColor: '#f3f4f6',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  multiline: { minHeight: 72, textAlignVertical: 'top' },
  actions: { flexDirection: 'row', gap: 10, marginTop: 22 },
  cancel: {
    flex: 1,
    backgroundColor: '#f3f4f6',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  cancelText: { fontSize: 16, fontWeight: '600', color: '#374151' },
  save: {
    flex: 2,
    backgroundColor: '#0891b2',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  saveOff: { backgroundColor: '#a5b4c3' },
  saveText: { fontSize: 16, fontWeight: '700', color: '#fff' },
});
