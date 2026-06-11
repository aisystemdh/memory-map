// 두 좌표 사이 거리(미터). 한국 위도(약 33~38도) 범위에서 충분한 근사값.
export function distanceMeters(
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number
): number {
  const dLat = (aLat - bLat) * 111000; // 위도 1도 ≈ 111km
  const dLng = (aLng - bLng) * 88000; // 경도 1도 ≈ 111km × cos(37°)
  return Math.sqrt(dLat * dLat + dLng * dLng);
}
