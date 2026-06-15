import { supabase } from './supabase';
import { getCurrentUserId } from './currentUser';

// 사용자 정의 카테고리 한 건
export type Category = {
  id: string;
  name: string;
  color: string; // hex 문자열, 예: '#1d4ed8'
  created_at: string;
};

// 추천 팔레트 8색 — 카테고리 관리 화면과 저장 모달의 인라인 추가에서 같이 쓴다
export const CATEGORY_PALETTE = [
  '#ef4444', // 빨강
  '#f97316', // 주황
  '#eab308', // 노랑
  '#22c55e', // 초록
  '#06b6d4', // 청록
  '#3b82f6', // 파랑
  '#8b5cf6', // 보라
  '#ec4899', // 분홍
];

// 본인 카테고리 조회 (만든 순). RLS와 함께 코드에서도 user_id로 한정한다.
export async function fetchCategories(): Promise<Category[]> {
  const userId = await getCurrentUserId();
  const { data, error } = await supabase
    .from('categories')
    .select('id, name, color, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as Category[];
}

// 카테고리 추가 (현재 로그인 사용자 소유로)
export async function addCategory(name: string, color: string): Promise<Category> {
  const userId = await getCurrentUserId();
  const { data, error } = await supabase
    .from('categories')
    .insert({ name, color, user_id: userId })
    .select('id, name, color, created_at')
    .single();
  if (error) throw error;
  return data as Category;
}

// 카테고리 삭제 (본인 것만).
// places.category_id는 DB의 ON DELETE SET NULL 규칙으로 분류만 해제되고 장소는 보존된다.
export async function deleteCategory(id: string): Promise<void> {
  const userId = await getCurrentUserId();
  const { error } = await supabase
    .from('categories')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);
  if (error) throw error;
}
