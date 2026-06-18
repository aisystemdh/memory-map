import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

// 뷰어 하단 바에 보여줄 현재 상태
export type ViewerInfo = {
  title: string;
  total: number;
  index: number; // 0-based 현재 위치
  currentName: string;
  isFriendRoute: boolean; // 친구 루트면 "내 루트로 가져오기"가 보인다
};

type Props = {
  info: ViewerInfo;
  imported: boolean; // 친구 루트를 이미 담았는지
  onPrev: () => void;
  onNext: () => void;
  onClose: () => void;
  onImport: () => void;
};

// 루트 뷰어 하단 컨트롤 바.
// [← 이전]/[다음 →]으로 핀을 하나씩 짚는다(지도는 App이 자동으로 이동시킨다). [닫기]로 빠져나온다.
// 친구 루트면 "내 루트로 가져오기"(담기 1단계)가 함께 보인다.
export default function RouteViewerBar({
  info,
  imported,
  onPrev,
  onNext,
  onClose,
  onImport,
}: Props) {
  const atStart = info.index <= 0;
  const atEnd = info.index >= info.total - 1;

  return (
    <View style={styles.bar}>
      <View style={styles.headerRow}>
        <Text style={styles.title} numberOfLines={1}>
          {info.title}
        </Text>
        <TouchableOpacity onPress={onClose} hitSlop={10}>
          <Text style={styles.close}>닫기</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.current} numberOfLines={1}>
        {info.total > 0 ? `${info.index + 1}/${info.total} · ${info.currentName}` : '장소가 없어요'}
      </Text>

      <View style={styles.navRow}>
        <TouchableOpacity
          style={[styles.navBtn, atStart && styles.navOff]}
          onPress={onPrev}
          disabled={atStart}
        >
          <Text style={styles.navText}>← 이전</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.navBtn, atEnd && styles.navOff]}
          onPress={onNext}
          disabled={atEnd}
        >
          <Text style={styles.navText}>다음 →</Text>
        </TouchableOpacity>
      </View>

      {info.isFriendRoute && (
        <TouchableOpacity
          style={[styles.importBtn, imported && styles.importedBtn]}
          onPress={onImport}
          disabled={imported}
        >
          <Text style={[styles.importText, imported && styles.importedText]}>
            {imported ? '담음 ✓' : '내 루트로 가져오기'}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 24,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 6,
  },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { flex: 1, fontSize: 17, fontWeight: '700', color: '#111827' },
  close: { fontSize: 15, fontWeight: '600', color: '#2563eb', paddingLeft: 10 },
  current: { fontSize: 14, color: '#374151', marginTop: 8 },
  navRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  navBtn: {
    flex: 1,
    backgroundColor: '#1d4ed8',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  navOff: { backgroundColor: '#c7d2e8' },
  navText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  importBtn: {
    backgroundColor: '#db2777',
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 10,
  },
  importedBtn: { backgroundColor: '#f3f4f6' },
  importText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  importedText: { color: '#6b7280' },
});

