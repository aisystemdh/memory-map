import { useEffect, useState } from 'react';
import {
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
  placeCount: number; // 오늘 다녀온 곳 수
  saving: boolean;
  onConfirm: (title: string) => void;
  onDecline: () => void;
};

// STEP 4: 같은 날 2번째 체크인이 감지되면 뜨는 제안 모달.
// "오늘 다녀온 곳을 루트로 남길까요?" → 제목 입력 후 남기기 / 안 남기기.
export default function AutoRouteModal({ visible, placeCount, saving, onConfirm, onDecline }: Props) {
  const [title, setTitle] = useState('');

  useEffect(() => {
    if (visible) setTitle('');
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDecline}>
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.card}>
          <Text style={styles.title}>오늘 다녀온 곳을 루트로 남길까요?</Text>
          <Text style={styles.subtitle}>
            오늘 다녀온 {placeCount}곳을 하나의 동선으로 저장해요. 오늘 더 체크인하면 자동으로
            이어집니다.
          </Text>

          <TextInput
            style={styles.input}
            placeholder="루트 이름 (예: 오늘의 데이트)"
            value={title}
            onChangeText={setTitle}
            maxLength={40}
          />

          <View style={styles.actions}>
            <TouchableOpacity style={styles.decline} onPress={onDecline} disabled={saving}>
              <Text style={styles.declineText}>안 남기기</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.confirm, (!title.trim() || saving) && styles.confirmOff]}
              onPress={() => onConfirm(title.trim())}
              disabled={!title.trim() || saving}
            >
              <Text style={styles.confirmText}>{saving ? '저장 중...' : '루트로 남기기'}</Text>
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
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 20 },
  title: { fontSize: 18, fontWeight: '700', color: '#111827' },
  subtitle: { fontSize: 14, color: '#6b7280', marginTop: 8, lineHeight: 20 },
  input: {
    backgroundColor: '#f3f4f6',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    marginTop: 16,
  },
  actions: { flexDirection: 'row', gap: 10, marginTop: 18 },
  decline: {
    flex: 1,
    backgroundColor: '#f3f4f6',
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
  },
  declineText: { fontSize: 15, fontWeight: '600', color: '#374151' },
  confirm: {
    flex: 2,
    backgroundColor: '#16a34a',
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
  },
  confirmOff: { backgroundColor: '#a7d7b6' },
  confirmText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});
