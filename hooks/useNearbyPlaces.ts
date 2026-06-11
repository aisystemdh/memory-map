import { useEffect, useRef, useState } from 'react';
import { Region } from 'react-native-maps';
import { distanceMeters } from '../lib/geo';
import { KakaoPlace, searchNearbyPlaces } from '../lib/kakao';

// 과축소 기준: 이보다 넓게 보면 호출하지 않고 라벨을 숨긴다 (세로 약 11km, 구 단위 이상)
const MAX_DELTA = 0.1;
// 이동이 완전히 멈춘 뒤 이만큼 지나서 1회만 호출 (드래그 중 연속 호출 방지)
const DEBOUNCE_MS = 600;

// 줌 레벨(latitudeDelta)에 비례한 검색 반경: 화면 세로의 약 1/3
function radiusFor(region: Region): number {
  return Math.min(2000, Math.max(150, Math.round((region.latitudeDelta * 111000) / 3)));
}

// 지도 멈춤 좌표 주변의 카카오 장소를 자동으로 받아오는 훅.
// 호출 절약이 핵심: 디바운스 + 미세 이동 무시 + 과축소 시 숨김. (카카오 무료 일일 한도 보호)
export function useNearbyPlaces() {
  const [nearby, setNearby] = useState<KakaoPlace[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 직전 호출의 중심·반경 — 거의 안 움직였으면 재호출하지 않기 위한 기억
  const lastFetch = useRef<{ latitude: number; longitude: number; radius: number } | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    []
  );

  function handleRegionChange(region: Region) {
    if (timer.current) clearTimeout(timer.current);

    // 너무 축소된 상태에서는 호출하지 않고 레이어를 숨긴다
    if (region.latitudeDelta > MAX_DELTA) {
      setNearby([]);
      lastFetch.current = null;
      return;
    }

    timer.current = setTimeout(() => {
      const radius = radiusFor(region);

      // 직전 호출 중심에서 반경의 30% 이내로만 움직였고 줌도 비슷하면 재호출 금지
      if (lastFetch.current) {
        const moved = distanceMeters(
          region.latitude,
          region.longitude,
          lastFetch.current.latitude,
          lastFetch.current.longitude
        );
        const zoomChangedALot =
          Math.abs(radius - lastFetch.current.radius) / lastFetch.current.radius > 0.3;
        if (moved < lastFetch.current.radius * 0.3 && !zoomChangedALot) return;
      }

      lastFetch.current = { latitude: region.latitude, longitude: region.longitude, radius };
      searchNearbyPlaces(region.latitude, region.longitude, radius)
        .then(setNearby)
        .catch(() => {
          // 실패는 조용히 무시 — 라벨만 안 뜬다 (에러 화면 금지)
        });
    }, DEBOUNCE_MS);
  }

  return { nearby, handleRegionChange };
}
