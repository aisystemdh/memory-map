import { supabase } from './supabase';

// 현재 로그인 사용자 id의 단일 출처.
// INSERT에 채우고 SELECT/UPDATE/DELETE를 본인 데이터로 한정할 때 쓴다.
// 세션은 로컬에 저장돼 있어 빠르게 읽힌다(서버 검증은 RLS가 최종적으로 한다).
export async function getCurrentUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  const id = data.session?.user?.id;
  if (!id) throw new Error('로그인이 필요합니다.');
  return id;
}
