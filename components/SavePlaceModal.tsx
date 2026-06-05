import DateTimePicker from '@react-native-community/datetimepicker';
import { useState } from 'react';
import {
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { KakaoPlace } from '../lib/kakao';

type Props = {
  // 저장할 대상 장소. null이면 모달이 닫힘.
  place: KakaoPlace | null;
  saving: boolean;
  onCancel: () => void;
  onSave: (visitedOn: string, memo: string) => void;
};

// Date 객체를 YYYY-MM-DD 문자열로 (현지 시간 기준)
function toDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export default function SavePlaceModal({ place, saving, onCancel, onSave }: Props) {
  const [date, setDate] = useState<Date>(new Date());
  const [memo, setMemo] = useState('');
  const [showPicker, setShowPicker] = useState(Platform.OS === 'ios');

  function handleSave() {
    onSave(toDateString(date), memo.trim());
    // 다음 저장을 위해 초기화
    setMemo('');
    setDate(new Date());
    setShowPicker(Platform.OS === 'ios');
  }

  return (
    <Modal
      visible={place !== null}
      transparent
      animationType="slide"
      onRequestClose={onCancel}
    >
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <Text style={styles.title}>{place?.name}</Text>
          {place?.address ? (
            <Text style={styles.address}>{place.address}</Text>
          ) : null}

          <Text style={styles.label}>날짜</Text>
          {Platform.OS === 'android' && (
            <TouchableOpacity
              style={styles.dateButton}
              onPress={() => setShowPicker(true)}
            >
              <Text style={styles.dateButtonText}>{toDateString(date)}</Text>
            </TouchableOpacity>
          )}
          {showPicker && (
            <DateTimePicker
              value={date}
              mode="date"
              display="default"
              maximumDate={new Date()}
              onChange={(event, selected) => {
                if (Platform.OS === 'android') setShowPicker(false);
                if (event.type === 'set' && selected) setDate(selected);
              }}
            />
          )}

          <Text style={styles.label}>한 줄 메모</Text>
          <TextInput
            style={styles.memoInput}
            placeholder="그날의 추억을 한 줄로 남겨보세요"
            value={memo}
            onChangeText={setMemo}
            maxLength={100}
          />

          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={onCancel}
              disabled={saving}
            >
              <Text style={styles.cancelText}>취소</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, styles.saveButton]}
              onPress={handleSave}
              disabled={saving}
            >
              <Text style={styles.saveText}>{saving ? '저장 중...' : '저장'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
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
  address: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 4,
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
