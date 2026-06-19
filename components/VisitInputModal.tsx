import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { pickPhotos, PickedPhoto } from '../lib/photos';

type Props = {
  visible: boolean;
  // 시트 제목 (예: "방문 추가" / "다녀왔어요!")
  title: string;
  saving: boolean;
  onSubmit: (visitedOn: string, memo: string, photos: PickedPhoto[]) => void;
  onCancel: () => void;
};

// Date → YYYY-MM-DD (현지 시간)
function toDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// 한 번의 "방문"(날짜·메모·사진)을 입력받는 공용 시트.
// 방문 추가와 체크인이 똑같이 쓴다(상태 전환 여부는 호출부가 판단).
export default function VisitInputModal({ visible, title, saving, onSubmit, onCancel }: Props) {
  const [date, setDate] = useState<Date>(new Date());
  const [memo, setMemo] = useState('');
  const [photos, setPhotos] = useState<PickedPhoto[]>([]);
  const [picking, setPicking] = useState(false);

  function reset() {
    setDate(new Date());
    setMemo('');
    setPhotos([]);
  }

  // 안드로이드는 모달 안 인라인 피커 문제를 피해 명령형 다이얼로그로 연다(초기값=오늘/기존).
  function openDatePicker() {
    DateTimePickerAndroid.open({
      value: date,
      mode: 'date',
      maximumDate: new Date(),
      onChange: (event, selected) => {
        if (event.type === 'set' && selected) setDate(selected);
      },
    });
  }

  function handleSubmit() {
    onSubmit(toDateString(date), memo.trim(), photos);
    reset();
  }

  function handleCancel() {
    reset();
    onCancel();
  }

  async function handlePickPhotos() {
    setPicking(true);
    try {
      const picked = await pickPhotos();
      if (picked.length > 0) setPhotos((prev) => [...prev, ...picked]);
    } finally {
      setPicking(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleCancel}>
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.sheet}>
          <Text style={styles.title}>{title}</Text>

          <Text style={styles.label}>날짜</Text>
          {Platform.OS === 'android' ? (
            <TouchableOpacity style={styles.dateButton} onPress={openDatePicker}>
              <Text style={styles.dateButtonText}>{toDateString(date)}</Text>
            </TouchableOpacity>
          ) : (
            <DateTimePicker
              value={date}
              mode="date"
              display="default"
              maximumDate={new Date()}
              onChange={(event, selected) => {
                if (event.type === 'set' && selected) setDate(selected);
              }}
            />
          )}

          <Text style={styles.label}>한 줄 메모 (선택)</Text>
          <TextInput
            style={styles.memoInput}
            placeholder="그날의 추억을 한 줄로"
            value={memo}
            onChangeText={setMemo}
            maxLength={100}
          />

          <Text style={styles.label}>사진 (선택)</Text>
          {photos.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.thumbRow}>
              {photos.map((p, i) => (
                <Image key={i} source={{ uri: p.uri }} style={styles.thumb} />
              ))}
            </ScrollView>
          )}
          <TouchableOpacity
            style={styles.addPhotoButton}
            onPress={handlePickPhotos}
            disabled={picking || saving}
          >
            <Text style={styles.addPhotoText}>{picking ? '불러오는 중...' : '+ 사진 추가'}</Text>
          </TouchableOpacity>

          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={handleCancel}
              disabled={saving}
            >
              <Text style={styles.cancelText}>취소</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, styles.saveButton]}
              onPress={handleSubmit}
              disabled={saving}
            >
              <Text style={styles.saveText}>{saving ? '저장 중...' : '저장'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 32,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginTop: 18,
    marginBottom: 8,
  },
  dateButton: {
    backgroundColor: '#f3f4f6',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    alignSelf: 'flex-start',
  },
  dateButtonText: {
    fontSize: 16,
    color: '#111827',
  },
  memoInput: {
    backgroundColor: '#f3f4f6',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  thumbRow: {
    marginBottom: 4,
  },
  thumb: {
    width: 72,
    height: 72,
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
    marginTop: 4,
  },
  addPhotoText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#2563eb',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  button: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#f3f4f6',
  },
  cancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  saveButton: {
    backgroundColor: '#2563eb',
  },
  saveText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});
