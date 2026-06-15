import { useState } from 'react';
import {
  Alert,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useAuth } from '../context/AuthContext';

type Props = {
  visible: boolean;
  onClose: () => void;
};

export default function SettingsScreen({ visible, onClose }: Props) {
  const { user, signOut } = useAuth();
  const [busy, setBusy] = useState(false);

  // 닉네임은 가입 때 넘긴 user metadata에서 읽는다 (profiles 조회는 다음 단계에서).
  const nickname = (user?.user_metadata?.nickname as string | undefined) ?? '(닉네임 없음)';
  const email = user?.email ?? '(이메일 없음)';

  async function handleSignOut() {
    setBusy(true);
    try {
      await signOut();
      // 로그아웃하면 onAuthStateChange가 로그인 화면으로 전환한다.
    } catch (e) {
      Alert.alert('로그아웃 실패', e instanceof Error ? e.message : '오류가 발생했습니다.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>설정</Text>
          <TouchableOpacity onPress={onClose} hitSlop={10}>
            <Text style={styles.close}>닫기</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.field}>
          <Text style={styles.fieldLabel}>닉네임</Text>
          <Text style={styles.fieldValue}>{nickname}</Text>
        </View>

        <View style={styles.field}>
          <Text style={styles.fieldLabel}>이메일</Text>
          <Text style={styles.fieldValue}>{email}</Text>
        </View>

        <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut} disabled={busy}>
          <Text style={styles.signOutText}>{busy ? '로그아웃 중...' : '로그아웃'}</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    paddingHorizontal: 24,
    paddingTop: 60,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
  },
  close: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2563eb',
  },
  field: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  fieldLabel: {
    fontSize: 13,
    color: '#9ca3af',
    marginBottom: 4,
  },
  fieldValue: {
    fontSize: 17,
    color: '#111827',
    fontWeight: '600',
  },
  signOutButton: {
    backgroundColor: '#fef2f2',
    borderRadius: 10,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 40,
  },
  signOutText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#dc2626',
  },
});
