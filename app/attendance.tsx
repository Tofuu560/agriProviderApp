import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import { useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const colors = {
  primary: '#1F6B3A',
  amber: '#F2A93B',
  background: '#F7F8F5',
  card: '#FFFFFF',
  text: '#1A1A1A',
  muted: '#727A73',
  border: '#E4E8E2',
  danger: '#C8442B',
};

type AttendanceStatus = 'Present' | 'Absent' | 'Late';

const learners = [
  { id: 'L-1042', name: 'Ayanda Mokoena', initials: 'AM' },
  { id: 'L-1087', name: 'Lerato Khumalo', initials: 'LK' },
  { id: 'L-1124', name: 'Sipho Dlamini', initials: 'SD' },
  { id: 'L-1190', name: 'Nomsa Ndlovu', initials: 'NN' },
];

const statuses: AttendanceStatus[] = ['Present', 'Absent', 'Late'];
const storagePrefix = '@agriprovider/attendance/';
const syncUrl = 'http://10.2.43.219:3000/api/attendance/sync';

type AttendanceRecord = {
  id: string;
  date: string;
  synced: boolean;
  learners: Array<{
    learnerId: string;
    learnerName: string;
    status: AttendanceStatus;
  }>;
};

async function createUuid() {
  const bytes = await Crypto.getRandomBytesAsync(16);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(
    16,
    20,
  )}-${hex.slice(20)}`;
}

export default function AttendanceScreen() {
  const [attendance, setAttendance] = useState<Record<string, AttendanceStatus>>(
    Object.fromEntries(learners.map((learner) => [learner.id, 'Present'])) as Record<
      string,
      AttendanceStatus
    >,
  );
  const [busyAction, setBusyAction] = useState<'saving' | 'syncing' | null>(null);

  function chooseStatus(learnerId: string, status: AttendanceStatus) {
    setAttendance((current) => ({ ...current, [learnerId]: status }));
  }

  async function saveAttendance() {
    if (busyAction) return;
    setBusyAction('saving');

    try {
      const record: AttendanceRecord = {
        id: await createUuid(),
        date: new Date().toISOString(),
        synced: false,
        learners: learners.map((learner) => ({
          learnerId: learner.id,
          learnerName: learner.name,
          status: attendance[learner.id],
        })),
      };
      await AsyncStorage.setItem(`${storagePrefix}${record.id}`, JSON.stringify(record));
      Alert.alert('Saved locally', 'Attendance is saved on this device and can be synced later.');
    } catch (error) {
      Alert.alert('Could not save attendance', 'Please try again when your device is ready.');
      console.error('Failed to save offline attendance', error);
    } finally {
      setBusyAction(null);
    }
  }

  async function syncAttendance() {
    if (busyAction) return;
    setBusyAction('syncing');

    try {
      const keys = (await AsyncStorage.getAllKeys()).filter((key) =>
        key.startsWith(storagePrefix),
      );
      if (keys.length === 0) {
        Alert.alert('Nothing to sync', 'There are no locally saved attendance records.');
        return;
      }

      const storedEntries = await AsyncStorage.multiGet(keys);
      const records: AttendanceRecord[] = [];
      for (const [key, value] of storedEntries) {
        if (value === null) {
          throw new Error(`Attendance record ${key} could not be read.`);
        }
        const record = JSON.parse(value) as AttendanceRecord;
        if (!record.id || key !== `${storagePrefix}${record.id}`) {
          throw new Error(`Attendance record ${key} is invalid.`);
        }
        if (record.synced === true) continue;
        if (record.synced !== false) throw new Error(`Attendance record ${key} is invalid.`);
        records.push(record);
      }

      if (records.length === 0) {
        Alert.alert('Nothing to sync', 'There are no locally saved attendance records.');
        return;
      }

      const response = await fetch(syncUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ records }),
      });
      const result = (await response.json()) as { syncedIds?: unknown; error?: string };
      if (!response.ok) {
        throw new Error(result.error || `The server returned ${response.status}.`);
      }

      const syncedIds = result.syncedIds;
      if (
        !Array.isArray(syncedIds) ||
        !records.every((record) => syncedIds.includes(record.id))
      ) {
        throw new Error('The server did not confirm every attendance record.');
      }

      await AsyncStorage.multiSet(
        records.map((record) => [
          `${storagePrefix}${record.id}`,
          JSON.stringify({ ...record, synced: true }),
        ]),
      );
      Alert.alert('Sync complete', `${records.length} attendance record(s) synced successfully.`);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Check your connection and try again.';
      Alert.alert('Sync failed', message);
      console.error('Failed to sync attendance', error);
    } finally {
      setBusyAction(null);
    }
  }

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <View style={styles.screen}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Attendance</Text>
            <Text style={styles.subtitle}>Emerging Farmers · Session 04</Text>
          </View>
          <View style={styles.offlineBadge}>
            <Text style={styles.offlineText}>○ Local attendance queue</Text>
          </View>
        </View>

        <View style={styles.banner}>
          <Text style={styles.bannerIcon}>↻</Text>
          <Text style={styles.bannerText}>
            Attendance stays saved here until you tap Sync Now while connected.
          </Text>
        </View>

        <View style={styles.listHeader}>
          <Text style={styles.sectionTitle}>Learners</Text>
          <Text style={styles.countText}>{learners.length} learners</Text>
        </View>

        <ScrollView
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        >
          {learners.map((learner) => (
            <View key={learner.id} style={styles.learnerCard}>
              <View style={styles.learnerInfo}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{learner.initials}</Text>
                </View>
                <View style={styles.learnerNames}>
                  <Text style={styles.learnerName}>{learner.name}</Text>
                  <Text style={styles.learnerId}>{learner.id}</Text>
                </View>
              </View>
              <View style={styles.statusRow}>
                {statuses.map((status) => {
                  const selected = attendance[learner.id] === status;
                  return (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      key={status}
                      onPress={() => chooseStatus(learner.id, status)}
                      style={[
                        styles.statusButton,
                        selected && styles.selectedStatus,
                        selected && status === 'Absent' && styles.selectedAbsent,
                        selected && status === 'Late' && styles.selectedLate,
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusText,
                          selected && styles.selectedStatusText,
                          selected && status === 'Absent' && styles.selectedAbsentText,
                          selected && status === 'Late' && styles.selectedLateText,
                        ]}
                      >
                        {status === 'Present' ? '✓ Present' : status === 'Absent' ? '✕ Absent' : 'Late'}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ))}
        </ScrollView>

        <SafeAreaView edges={['bottom']} style={styles.footer}>
          <View style={styles.footerButtons}>
            <Pressable
              accessibilityRole="button"
              disabled={busyAction !== null}
              onPress={saveAttendance}
              style={({ pressed }) => [
                styles.saveButton,
                (pressed || busyAction !== null) && styles.pressed,
              ]}
            >
              <Text style={styles.saveButtonText}>
                {busyAction === 'saving' ? 'Saving…' : 'Save & sync later'}
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={busyAction !== null}
              onPress={syncAttendance}
              style={({ pressed }) => [
                styles.syncButton,
                (pressed || busyAction !== null) && styles.pressed,
              ]}
            >
              <Text style={styles.syncButtonText}>
                {busyAction === 'syncing' ? 'Syncing…' : 'Sync Now'}
              </Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  screen: { flex: 1, width: '100%', maxWidth: 640, alignSelf: 'center' },
  header: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 17 },
  title: { color: colors.text, fontSize: 24, fontWeight: '800' },
  subtitle: { color: colors.muted, fontSize: 13, marginTop: 5 },
  offlineBadge: {
    alignSelf: 'flex-start',
    borderRadius: 20,
    backgroundColor: '#FFF1D8',
    paddingHorizontal: 11,
    paddingVertical: 7,
    marginTop: 13,
  },
  offlineText: { color: '#805612', fontSize: 12, fontWeight: '700' },
  banner: {
    marginHorizontal: 20,
    borderRadius: 10,
    backgroundColor: '#FFF1D8',
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 13,
    marginBottom: 18,
  },
  bannerIcon: { color: '#A66608', fontSize: 20, fontWeight: '700', marginRight: 10 },
  bannerText: { flex: 1, color: '#704B14', fontSize: 13, fontWeight: '600', lineHeight: 18 },
  listHeader: {
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sectionTitle: { color: colors.text, fontSize: 17, fontWeight: '800' },
  countText: { color: colors.muted, fontSize: 12 },
  listContent: { paddingHorizontal: 20, paddingBottom: 12, gap: 11 },
  learnerCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  learnerInfo: { flexDirection: 'row', alignItems: 'center', marginBottom: 13 },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#EAF2EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: colors.primary, fontSize: 13, fontWeight: '800' },
  learnerNames: { marginLeft: 11 },
  learnerName: { color: colors.text, fontSize: 14, fontWeight: '700' },
  learnerId: { color: colors.muted, fontSize: 12, marginTop: 3 },
  statusRow: { flexDirection: 'row', gap: 7 },
  statusButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  selectedStatus: { backgroundColor: '#EAF2EB', borderColor: colors.primary },
  selectedAbsent: { backgroundColor: '#FCEBE8', borderColor: colors.danger },
  selectedLate: { backgroundColor: '#FFF4E1', borderColor: colors.amber },
  statusText: { color: colors.muted, fontSize: 11, fontWeight: '600' },
  selectedStatusText: { color: colors.primary, fontWeight: '800' },
  selectedAbsentText: { color: colors.danger },
  selectedLateText: { color: '#8C5D12' },
  footer: {
    backgroundColor: colors.background,
    paddingHorizontal: 20,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  footerButtons: { flexDirection: 'row', gap: 10 },
  saveButton: {
    flex: 1.4,
    minHeight: 54,
    borderRadius: 8,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonText: { color: colors.card, fontSize: 13, fontWeight: '800' },
  syncButton: {
    flex: 1,
    minHeight: 54,
    borderRadius: 8,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  syncButtonText: { color: colors.primary, fontSize: 14, fontWeight: '800' },
  pressed: { opacity: 0.75 },
});
