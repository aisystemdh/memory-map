import { useCallback, useEffect, useState } from 'react';
import * as Location from 'expo-location';

// 현재 위치 좌표 (위도/경도)
export type Coords = {
  latitude: number;
  longitude: number;
};

// 위치 권한 상태
// - loading: 아직 확인 중
// - granted: 허용됨
// - denied: 거부됨
// - error: 위치 기능에서 오류가 남
export type LocationStatus = 'loading' | 'granted' | 'denied' | 'error';

// 위치 권한 요청 + 현재 위치를 가져오는 훅.
// - 화면에 들어올 때(마운트 시) 포그라운드 위치 권한을 한 번 요청한다.
// - 권한이 허용되면 현재 위치를 가져온다.
// - 권한 거부·오류가 나도 앱이 죽지 않도록 try/catch로 감싼다.
export function useCurrentLocation() {
  // 현재 위치 (아직 없으면 null)
  const [location, setLocation] = useState<Coords | null>(null);
  // 권한/위치 상태
  const [status, setStatus] = useState<LocationStatus>('loading');

  // 현재 위치를 한 번 가져와서 저장 (성공 시 좌표를 돌려준다)
  const refreshLocation = useCallback(async (): Promise<Coords | null> => {
    try {
      const current = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const coords = {
        latitude: current.coords.latitude,
        longitude: current.coords.longitude,
      };
      setLocation(coords);
      return coords;
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        // 포그라운드(앱 사용 중) 위치 권한 요청
        const { status: perm } = await Location.requestForegroundPermissionsAsync();
        if (!active) return;

        if (perm !== 'granted') {
          // 거부됨 → 안내 문구만 띄우고 조용히 종료
          setStatus('denied');
          return;
        }

        // 허용됨 → 먼저 상태를 granted로 바꿔 블루닷·버튼이 보이게 하고,
        // 위치는 뒤이어 가져온다 (느려도 화면은 막히지 않음)
        setStatus('granted');
        await refreshLocation();
      } catch {
        // 위치 권한·조회 중 오류가 나도 앱이 죽지 않게 처리 (기존 지도는 그대로 동작)
        if (active) setStatus('error');
      }
    }

    load();

    return () => {
      active = false;
    };
  }, [refreshLocation]);

  return { location, status, refreshLocation };
}
