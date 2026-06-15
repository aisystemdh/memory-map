import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  // 키가 없으면 저장이 동작하지 않습니다. .env 파일을 확인하세요.
  console.warn(
    'Supabase 환경변수가 비어 있습니다. .env에 EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY를 채워주세요.'
  );
}

// 로그인 세션을 기기에 저장(AsyncStorage)해 앱을 껐다 켜도 유지되게 한다.
// detectSessionInUrl은 웹 전용이라 RN에서는 끈다.
export const supabase = createClient(supabaseUrl ?? '', supabaseAnonKey ?? '', {
  auth: {
    storage: AsyncStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});
