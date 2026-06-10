import { useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Place } from '../lib/places';
import { getPhotoUrl } from '../lib/photos';
import { usePlacePhotos } from '../hooks/usePlacePhotos';
import { Category } from '../lib/categories';

type Props = {
  // 누른 핀의 장소. null이면 카드 숨김.
  place: Place | null;
  categories: Category[];
  // 분류 변경 (null = 분류 해제). 실제 저장·상태 갱신은 App이 담당.
  onChangeCategory: (placeId: string, categoryId: string | null) => void;
  onClose: () => void;
};

export default function PlaceCard({ place, categories, onChangeCategory, onClose }: Props) {
  // 훅은 항상 같은 순서로 호출되어야 하므로 early return 전에 호출한다.
  const { photos, adding, addPhotos } = usePlacePhotos(place?.id ?? null);
  // 분류 선택 줄 열림 여부
  const [pickerOpen, setPickerOpen] = useState(false);

  if (!place) return null;

  // 현재 분류 (삭제됐거나 미지정이면 '분류 없음' 취급)
  const current = categories.find((c) => c.id === place.category_id) ?? null;

  function handlePick(categoryId: string | null) {
    setPickerOpen(false);
    if (!place) return;
    if (categoryId !== (current?.id ?? null)) {
      onChangeCategory(place.id, categoryId);
    }
  }

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.name} numberOfLines={1}>
          {place.name}
        </Text>
        <TouchableOpacity onPress={onClose} hitSlop={10}>
          <Text style={styles.close}>✕</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.date}>{place.visited_on}</Text>

      {place.memo ? (
        <Text style={styles.memo}>{place.memo}</Text>
      ) : (
        <Text style={styles.memoEmpty}>메모 없음</Text>
      )}

      {place.address ? (
        <Text style={styles.address} numberOfLines={1}>
          {place.address}
        </Text>
      ) : null}

      {/* 현재 분류 표시 — 누르면 변경 줄이 열린다 */}
      <TouchableOpacity
        style={styles.categoryChip}
        onPress={() => setPickerOpen((v) => !v)}
      >
        {current && <View style={[styles.chipDot, { backgroundColor: current.color }]} />}
        <Text style={styles.categoryChipText}>
          {current ? current.name : '분류 없음'} ▾
        </Text>
      </TouchableOpacity>

      {pickerOpen && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pickerRow}>
          <TouchableOpacity
            style={[styles.chip, current === null && styles.chipSelected]}
            onPress={() => handlePick(null)}
          >
            <Text style={styles.chipText}>분류 없음</Text>
          </TouchableOpacity>
          {categories.map((c) => (
            <TouchableOpacity
              key={c.id}
              style={[styles.chip, current?.id === c.id && styles.chipSelected]}
              onPress={() => handlePick(c.id)}
            >
              <View style={[styles.chipDot, { backgroundColor: c.color }]} />
              <Text style={styles.chipText}>{c.name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {photos.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.photoRow}
        >
          {photos.map((ph) => (
            <Image
              key={ph.id}
              source={{ uri: getPhotoUrl(ph.storage_path) }}
              style={styles.photo}
            />
          ))}
        </ScrollView>
      )}

      <TouchableOpacity
        style={styles.addPhotoButton}
        onPress={addPhotos}
        disabled={adding}
      >
        <Text style={styles.addPhotoText}>
          {adding ? '사진 추가 중...' : '+ 사진 추가'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 24,
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 5,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  name: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  close: {
    fontSize: 16,
    color: '#6b7280',
    paddingHorizontal: 6,
  },
  date: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1d4ed8',
    marginTop: 4,
  },
  memo: {
    fontSize: 15,
    color: '#374151',
    marginTop: 8,
  },
  memoEmpty: {
    fontSize: 15,
    color: '#9ca3af',
    marginTop: 8,
  },
  address: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 8,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#f3f4f6',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 7,
    marginTop: 10,
  },
  categoryChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  pickerRow: {
    marginTop: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8,
  },
  chipSelected: {
    backgroundColor: '#dbeafe',
    borderWidth: 1.5,
    borderColor: '#2563eb',
  },
  chipDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 6,
  },
  chipText: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '600',
  },
  photoRow: {
    marginTop: 12,
  },
  photo: {
    width: 96,
    height: 96,
    borderRadius: 8,
    marginRight: 8,
    backgroundColor: '#e5e7eb',
  },
  addPhotoButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#eff6ff',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginTop: 12,
  },
  addPhotoText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#2563eb',
  },
});
