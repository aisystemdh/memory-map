import { useCallback, useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { fetchPhotos, pickPhotos, uploadPhotos, PlacePhoto } from '../lib/photos';

// 한 장소의 사진을 불러오고, 새 사진을 추가하는 훅 (메모 카드에서 사용).
// placeId가 null이면(카드 닫힘) 아무것도 하지 않는다.
export function usePlacePhotos(placeId: string | null) {
  const [photos, setPhotos] = useState<PlacePhoto[]>([]);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);

  // 장소가 바뀌면 그 장소의 사진을 다시 불러온다.
  useEffect(() => {
    if (!placeId) {
      setPhotos([]);
      return;
    }
    let active = true;
    setLoading(true);
    fetchPhotos(placeId)
      .then((rows) => {
        if (active) setPhotos(rows);
      })
      .catch(() => {
        // 조회 실패해도 앱은 그대로 동작
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [placeId]);

  // 사진첩에서 골라 업로드 → 목록 갱신. 일부 실패 시 결과를 안내.
  const addPhotos = useCallback(async () => {
    if (!placeId) return;
    setAdding(true);
    try {
      const picked = await pickPhotos();
      if (picked.length === 0) return;
      const { uploaded, success, total } = await uploadPhotos(
        placeId,
        picked.map((p) => p.base64)
      );
      if (uploaded.length > 0) {
        setPhotos((prev) => [...prev, ...uploaded]);
      }
      if (success < total) {
        Alert.alert('사진 저장', `사진 ${total}장 중 ${success}장 저장됨`);
      }
    } finally {
      setAdding(false);
    }
  }, [placeId]);

  return { photos, loading, adding, addPhotos };
}
