import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import App from './App';
import { AuthProvider, useAuth } from './context/AuthContext';
import LoginScreen from './screens/LoginScreen';
import SignUpScreen from './screens/SignUpScreen';
import SettingsScreen from './screens/SettingsScreen';

// 로그인 전 화면: 로그인 ⇄ 회원가입 토글 (네비게이션 라이브러리 없이 상태로 전환)
function AuthFlow() {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  return mode === 'login' ? (
    <LoginScreen onGoSignUp={() => setMode('signup')} />
  ) : (
    <SignUpScreen onGoLogin={() => setMode('login')} />
  );
}

// 세션 유무에 따라 로그인 화면 / 기존 지도 메인을 가르는 게이트.
// 기존 App은 수정하지 않고, 그 위에 설정 진입 버튼만 오버레이로 얹는다.
function Gate() {
  const { session, loading } = useAuth();
  const [settingsOpen, setSettingsOpen] = useState(false);

  if (loading) {
    return (
      <View style={styles.splash}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  if (!session) return <AuthFlow />;

  return (
    <View style={styles.flex}>
      <App />
      {/* 기존 우측 버튼들(화면 중앙 높이)·검색바(상단)와 겹치지 않게 우하단에 */}
      <TouchableOpacity style={styles.settingsButton} onPress={() => setSettingsOpen(true)}>
        <Text style={styles.settingsButtonText}>설정</Text>
      </TouchableOpacity>
      <SettingsScreen visible={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </View>
  );
}

export default function RootApp() {
  return (
    <AuthProvider>
      <Gate />
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  splash: {
    flex: 1,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  settingsButton: {
    position: 'absolute',
    right: 16,
    bottom: 24,
    backgroundColor: '#374151',
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  settingsButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
});
