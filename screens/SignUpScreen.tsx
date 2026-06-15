import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useAuth } from '../context/AuthContext';

type Props = {
  // 로그인 화면으로 이동
  onGoLogin: () => void;
};

export default function SignUpScreen({ onGoLogin }: Props) {
  const { signUp } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [nickname, setNickname] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSignUp() {
    if (!email.trim() || !password || !nickname.trim()) {
      setError('이메일, 비밀번호, 닉네임은 필수입니다.');
      return;
    }
    if (password !== passwordConfirm) {
      setError('비밀번호가 서로 다릅니다.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { needsEmailConfirm } = await signUp(email.trim(), password, nickname.trim());
      if (needsEmailConfirm) {
        // 이메일 확인이 켜져 있으면 세션이 안 생긴다 — 안내 후 로그인 화면으로.
        Alert.alert(
          '확인 메일을 보냈어요',
          '메일에서 이메일을 확인한 뒤 로그인해 주세요.',
          [{ text: '확인', onPress: onGoLogin }]
        );
      }
      // 확인이 꺼져 있으면 onAuthStateChange가 자동으로 메인으로 전환한다.
    } catch (e) {
      setError(e instanceof Error ? e.message : '회원가입에 실패했습니다.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.inner} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>회원가입</Text>

        <Text style={styles.label}>이메일</Text>
        <TextInput
          style={styles.input}
          placeholder="email@example.com"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          autoCorrect={false}
        />

        <Text style={styles.label}>비밀번호</Text>
        <TextInput
          style={styles.input}
          placeholder="비밀번호 (6자 이상)"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        <Text style={styles.label}>비밀번호 확인</Text>
        <TextInput
          style={styles.input}
          placeholder="비밀번호 다시 입력"
          value={passwordConfirm}
          onChangeText={setPasswordConfirm}
          secureTextEntry
        />

        <Text style={styles.label}>닉네임</Text>
        <TextInput
          style={styles.input}
          placeholder="표시할 이름"
          value={nickname}
          onChangeText={setNickname}
          maxLength={20}
        />

        {/* 프로필 사진: 이번 단계에서는 자리만. 실제 업로드는 이후 단계에서. */}
        <Text style={styles.label}>프로필 사진 (선택)</Text>
        <View style={styles.photoPlaceholder}>
          <Text style={styles.photoPlaceholderText}>나중에 추가할 수 있어요</Text>
        </View>

        {error && <Text style={styles.error}>{error}</Text>}

        <TouchableOpacity style={styles.button} onPress={handleSignUp} disabled={busy}>
          {busy ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>가입하기</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.linkRow} onPress={onGoLogin} disabled={busy}>
          <Text style={styles.linkText}>이미 계정이 있으신가요? 로그인</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  inner: {
    paddingHorizontal: 24,
    paddingVertical: 60,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginTop: 14,
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#f3f4f6',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  photoPlaceholder: {
    backgroundColor: '#f9fafb',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderStyle: 'dashed',
    paddingVertical: 20,
    alignItems: 'center',
  },
  photoPlaceholderText: {
    color: '#9ca3af',
    fontSize: 14,
  },
  error: {
    color: '#dc2626',
    fontSize: 14,
    marginTop: 14,
  },
  button: {
    backgroundColor: '#2563eb',
    borderRadius: 10,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 24,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  linkRow: {
    marginTop: 18,
    alignItems: 'center',
  },
  linkText: {
    color: '#2563eb',
    fontSize: 15,
    fontWeight: '600',
  },
});
