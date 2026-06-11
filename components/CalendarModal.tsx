import { useMemo } from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Calendar } from 'react-native-calendars';

type Props = {
  visible: boolean;
  // 기록(장소)이 있는 날짜들 (YYYY-MM-DD)
  recordedDates: string[];
  // 현재 선택된 날짜
  selectedDate: string | null;
  // 점 표시가 무엇을 뜻하는지 안내 문구 (가본/가볼 루트에 따라 다르게)
  hint?: string;
  onSelectDate: (date: string) => void;
  onClose: () => void;
};

const ACCENT = '#1d4ed8';

export default function CalendarModal({
  visible,
  recordedDates,
  selectedDate,
  hint = '점이 있는 날에 기록한 장소가 있어요.',
  onSelectDate,
  onClose,
}: Props) {
  // 달력에 점/선택 표시를 만들기
  const markedDates = useMemo(() => {
    const marks: Record<string, any> = {};
    for (const d of recordedDates) {
      marks[d] = { marked: true, dotColor: ACCENT };
    }
    if (selectedDate) {
      marks[selectedDate] = {
        ...(marks[selectedDate] ?? {}),
        selected: true,
        selectedColor: ACCENT,
      };
    }
    return marks;
  }, [recordedDates, selectedDate]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>날짜 선택</Text>
            <TouchableOpacity onPress={onClose} hitSlop={10}>
              <Text style={styles.close}>닫기</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.hint}>{hint}</Text>

          <Calendar
            markedDates={markedDates}
            onDayPress={(day) => onSelectDate(day.dateString)}
            theme={{
              todayTextColor: ACCENT,
              arrowColor: ACCENT,
              selectedDayBackgroundColor: ACCENT,
            }}
          />
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
    padding: 16,
    paddingBottom: 28,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  close: {
    fontSize: 16,
    fontWeight: '600',
    color: ACCENT,
  },
  hint: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 6,
    marginBottom: 8,
  },
});
