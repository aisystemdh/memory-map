import { useEffect, useState } from 'react';
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { Place } from '../lib/places';
import { Visit } from '../lib/visits';
import {
  fetchPhotosByVisits,
  getPhotoUrl,
  pickPhotos,
  uploadPhotos,
  VisitPhoto,
} from '../lib/photos';
import { Category } from '../lib/categories';

type Props = {
  // 누른 핀의 장소. null이면 카드 숨김.
  place: Place | null;
  // 이 장소의 방문들 (최근 방문 먼저). want/imported면 빈 배열.
  visits: Visit[];
  categories: Category[];
  // 분류 변경 (null = 분류 해제). 실제 저장·상태 갱신은 App이 담당.
  onChangeCategory: (placeId: string, categoryId: string | null) => void;
  // 방문 추가/체크인 시트 열기 요청 (실제 저장은 App이 담당).
  onRequestAddVisit: (place: Place) => void;
  onClose: () => void;
};

export default function PlaceCard({
  place,
  visits,
  categories,
  onChangeCategory,
  onRequestAddVisit,
  onClose,
}: Props) {
  const { width } = useWindowDimensions();
  // 카드 내부 폭(좌우 카드 마진 12*2 + 패딩 16*2) — 방문 슬라이드 한 장 폭
  const slideWidth = width - 24 - 32;

  // 방문별 사진 (visit_id → 사진들). 카드 열릴 때 한 번에 불러온다.
  const [photosByVisit, setPhotosByVisit] = useState<Record<string, VisitPhoto[]>>({});
  // 분류 선택 줄 열림 여부
  const [pickerOpen, setPickerOpen] = useState(false);
  // 사진 추가 중인 방문 id (버튼 비활성화용)
  const [addingTo, setAddingTo] = useState<string | null>(null);

  // 훅은 early return 전에 호출. 방문 목록이 바뀌면 사진을 다시 불러온다.
  const visitIdsKey = visits.map((v) => v.id).join(',');
  useEffect(() => {
    const ids = visitIdsKey ? visitIdsKey.split(',') : [];
    if (ids.length === 0) {
      setPhotosByVisit({});
      return;
    }
    let active = true;
    fetchPhotosByVisits(ids)
      .then((map) => {
        if (active) setPhotosByVisit(map);
      })
      .catch(() => {
        // 사진 조회 실패해도 카드는 그대로 동작
      });
    return () => {
      active = false;
    };
  }, [visitIdsKey]);

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

  // 특정 방문에 사진 추가
  async function handleAddPhoto(visitId: string) {
    setAddingTo(visitId);
    try {
      const picked = await pickPhotos();
      if (picked.length === 0) return;
      const { uploaded } = await uploadPhotos(
        visitId,
        picked.map((p) => p.base64)
      );
      if (uploaded.length > 0) {
        setPhotosByVisit((prev) => ({
          ...prev,
          [visitId]: [...(prev[visitId] ?? []), ...uploaded],
        }));
      }
    } finally {
      setAddingTo(null);
    }
  }

  const isVisited = place.status === 'visited';

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

      {place.address ? (
        <Text style={styles.address} numberOfLines={1}>
          {place.address}
        </Text>
      ) : null}

      {/* 현재 분류 표시 — 누르면 변경 줄이 열린다 */}
      <TouchableOpacity style={styles.categoryChip} onPress={() => setPickerOpen((v) => !v)}>
        {current && <View style={[styles.chipDot, { backgroundColor: current.color }]} />}
        <Text style={styles.categoryChipText}>{current ? current.name : '분류 없음'} ▾</Text>
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

      {isVisited ? (
        <>
          {/* 방문 슬라이드 — 한 장 = 방문 1건(날짜·메모·사진). 최근 방문이 먼저. */}
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            style={styles.slides}
          >
            {visits.map((v) => (
              <View key={v.id} style={[styles.slide, { width: slideWidth }]}>
                <Text style={styles.visitDate}>{v.visited_on}</Text>
                {v.memo ? (
                  <Text style={styles.visitMemo}>{v.memo}</Text>
                ) : (
                  <Text style={styles.visitMemoEmpty}>메모 없음</Text>
                )}

                {(photosByVisit[v.id]?.length ?? 0) > 0 && (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photoRow}>
                    {photosByVisit[v.id].map((ph) => (
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
                  onPress={() => handleAddPhoto(v.id)}
                  disabled={addingTo === v.id}
                >
                  <Text style={styles.addPhotoText}>
                    {addingTo === v.id ? '사진 추가 중...' : '+ 이 방문에 사진'}
                  </Text>
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>

          {visits.length > 1 && (
            <Text style={styles.slideHint}>← {visits.length}번의 방문 (옆으로 넘기기) →</Text>
          )}

          <TouchableOpacity style={styles.addVisitButton} onPress={() => onRequestAddVisit(place)}>
            <Text style={styles.addVisitText}>+ 방문 추가</Text>
          </TouchableOpacity>
        </>
      ) : (
        <>
          {/* 가보고 싶은 곳 / 가져온 곳 — 계획 정보 + 체크인 */}
          <Text style={styles.wantLabel}>
            {place.status === 'want' ? '가보고 싶은 곳' : '가져온 장소'}
          </Text>
          {place.plan_date ? (
            <Text style={styles.planText}>계획일: {place.plan_date}</Text>
          ) : (
            <Text style={styles.planTextMuted}>계획일 미정</Text>
          )}
          {place.plan_with ? <Text style={styles.planText}>함께: {place.plan_with}</Text> : null}

          <TouchableOpacity style={styles.checkInButton} onPress={() => onRequestAddVisit(place)}>
            <Text style={styles.checkInText}>다녀왔어요 (체크인)</Text>
          </TouchableOpacity>
        </>
      )}
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
  address: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 4,
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
  slides: {
    marginTop: 12,
  },
  slide: {
    paddingRight: 12,
  },
  visitDate: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1d4ed8',
  },
  visitMemo: {
    fontSize: 15,
    color: '#374151',
    marginTop: 6,
  },
  visitMemoEmpty: {
    fontSize: 15,
    color: '#9ca3af',
    marginTop: 6,
  },
  photoRow: {
    marginTop: 10,
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
    marginTop: 10,
  },
  addPhotoText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2563eb',
  },
  slideHint: {
    fontSize: 12,
    color: '#9ca3af',
    textAlign: 'center',
    marginTop: 8,
  },
  addVisitButton: {
    backgroundColor: '#1d4ed8',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 12,
  },
  addVisitText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
  wantLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#9333ea',
    marginTop: 10,
  },
  planText: {
    fontSize: 15,
    color: '#374151',
    marginTop: 6,
  },
  planTextMuted: {
    fontSize: 15,
    color: '#9ca3af',
    marginTop: 6,
  },
  checkInButton: {
    backgroundColor: '#16a34a',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 12,
  },
  checkInText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
});
