import { useCallback, useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { addCategory, deleteCategory, fetchCategories, Category } from '../lib/categories';

// 카테고리 목록 + 추가/삭제 훅.
// add/remove는 성공 여부(boolean)를 돌려줘서 호출한 쪽이 후처리를 할 수 있게 한다.
export function useCategories() {
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    fetchCategories()
      .then(setCategories)
      .catch(() => {
        // 조회 실패해도 앱은 그대로 동작 (카테고리 기능만 비어 보임)
      });
  }, []);

  const add = useCallback(async (name: string, color: string): Promise<boolean> => {
    try {
      const created = await addCategory(name, color);
      setCategories((prev) => [...prev, created]);
      return true;
    } catch (e) {
      Alert.alert('카테고리 추가 실패', e instanceof Error ? e.message : '오류가 발생했습니다.');
      return false;
    }
  }, []);

  const remove = useCallback(async (id: string): Promise<boolean> => {
    try {
      await deleteCategory(id);
      setCategories((prev) => prev.filter((c) => c.id !== id));
      return true;
    } catch (e) {
      Alert.alert('카테고리 삭제 실패', e instanceof Error ? e.message : '오류가 발생했습니다.');
      return false;
    }
  }, []);

  return { categories, add, remove };
}
