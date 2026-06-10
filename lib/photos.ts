import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { decode } from 'base64-arraybuffer';
import { supabase } from './supabase';

// Public Storage 버킷 이름 (이미 만들어져 있다고 전제)
const BUCKET = 'place-photos';

// place_photos 테이블의 사진 한 건
export type PlacePhoto = {
  id: string;
  place_id: string;
  storage_path: string;
  created_at: string;
};

// 사진첩에서 고른 사진 한 장 (업로드 전, JPEG로 변환된 상태)
export type PickedPhoto = {
  uri: string; // 화면 미리보기용 (로컬 경로)
  base64: string; // 업로드용 JPEG base64
};

// 여러 장 업로드 결과 요약
export type UploadResult = {
  uploaded: PlacePhoto[]; // 실제로 저장된 행들
  success: number; // 성공 장수
  total: number; // 시도한 전체 장수
};

// 사진첩 권한 요청 + 여러 장 선택 → 각 사진을 JPEG로 변환해 돌려준다.
// 권한 거부·취소·오류 시 빈 배열 (앱이 죽지 않게).
export async function pickPhotos(): Promise<PickedPhoto[]> {
  try {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return [];

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      quality: 1,
    });
    if (result.canceled) return [];

    // iOS의 HEIC 등 어떤 원본이든 JPEG로 변환한다.
    // → 업로드 시 contentType('image/jpeg')과 실제 파일 형식이 항상 일치.
    const photos: PickedPhoto[] = [];
    for (const asset of result.assets) {
      const image = await ImageManipulator.manipulate(asset.uri).renderAsync();
      const saved = await image.saveAsync({
        format: SaveFormat.JPEG,
        compress: 0.8,
        base64: true,
      });
      if (saved.base64) {
        photos.push({ uri: saved.uri, base64: saved.base64 });
      }
    }
    return photos;
  } catch {
    return [];
  }
}

// 충돌을 피하기 위한 고유 파일명
function uniqueName(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}.jpg`;
}

// 사진 한 장을 Storage에 올리고 place_photos에 행을 남긴다.
// 경로 형태: {place_id}/{고유파일명}.jpg
// 실패하면 throw (호출하는 쪽에서 부분 실패를 집계한다).
export async function uploadPhoto(placeId: string, base64: string): Promise<PlacePhoto> {
  const path = `${placeId}/${uniqueName()}`;
  // base64 → ArrayBuffer (fetch/blob·FormData는 Expo에서 0바이트 버그가 있어 쓰지 않음)
  const arrayBuffer = decode(base64);

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, arrayBuffer, { contentType: 'image/jpeg' });
  if (uploadError) throw uploadError;

  const { data, error } = await supabase
    .from('place_photos')
    .insert({ place_id: placeId, storage_path: path })
    .select('id, place_id, storage_path, created_at')
    .single();
  if (error) throw error;
  return data as PlacePhoto;
}

// 여러 장 업로드. 일부가 실패해도 성공한 것은 유지한다.
export async function uploadPhotos(placeId: string, base64List: string[]): Promise<UploadResult> {
  const uploaded: PlacePhoto[] = [];
  for (const base64 of base64List) {
    try {
      uploaded.push(await uploadPhoto(placeId, base64));
    } catch {
      // 이 한 장만 실패 → 건너뛴다 (나머지는 계속 시도)
    }
  }
  return { uploaded, success: uploaded.length, total: base64List.length };
}

// 한 장소의 사진들 조회 (오래된 순)
export async function fetchPhotos(placeId: string): Promise<PlacePhoto[]> {
  const { data, error } = await supabase
    .from('place_photos')
    .select('id, place_id, storage_path, created_at')
    .eq('place_id', placeId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as PlacePhoto[];
}

// storage_path → 화면 표시용 공개 URL
export function getPhotoUrl(storagePath: string): string {
  return supabase.storage.from(BUCKET).getPublicUrl(storagePath).data.publicUrl;
}
