import { router } from 'expo-router';
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
  border: '#E8EBE6',
};

const programmes = [
  {
    name: 'Emerging Farmers Programme',
    location: 'Eastern Cape · 2025 cohort',
    progress: [
      { label: 'Enrolment', value: 0.82 },
      { label: 'Attendance', value: 0.68 },
      { label: 'Certification', value: 0.34 },
    ],
  },
  {
    name: 'Sustainable Agriculture',
    location: 'KwaZulu-Natal · 2025 cohort',
    progress: [
      { label: 'Enrolment', value: 0.94 },
      { label: 'Attendance', value: 0.76 },
      { label: 'Certification', value: 0.21 },
    ],
  },
];

export default function ProviderScreen() {
  function showFeature(feature: string) {
    Alert.alert(feature, `${feature} is ready to be completed from your programme workspace.`);
  }

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Good morning, Thandi</Text>
            <Text style={styles.headerSub}>Here’s your programme overview</Text>
          </View>
          <View style={styles.sync}>
            <View style={styles.syncDot} />
            <Text style={styles.syncText}>Synced</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>My programmes</Text>
        {programmes.map((programme) => (
          <View key={programme.name} style={styles.programmeCard}>
            <Text style={styles.programmeName}>{programme.name}</Text>
            <Text style={styles.programmeMeta}>{programme.location}</Text>
            <View style={styles.progressList}>
              {programme.progress.map((item) => (
                <View key={item.label}>
                  <View style={styles.progressLabelRow}>
                    <Text style={styles.progressLabel}>{item.label}</Text>
                    <Text style={styles.progressValue}>{Math.round(item.value * 100)}%</Text>
                  </View>
                  <View style={styles.progressTrack}>
                    <View style={[styles.progressFill, { width: `${item.value * 100}%` }]} />
                  </View>
                </View>
              ))}
            </View>
          </View>
        ))}

        <Text style={styles.sectionTitle}>Quick actions</Text>
        <View style={styles.actionsRow}>
          <QuickAction icon="＋" label="Register" onPress={() => showFeature('Register learners')} />
          <QuickAction icon="✓" label="Attendance" onPress={() => router.push('/attendance')} />
          <QuickAction icon="↑" label="Upload" onPress={() => showFeature('Upload evidence')} />
        </View>

        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/qa-audit')}
          style={({ pressed }) => [styles.alertCard, pressed && styles.pressed]}
        >
          <Text style={styles.alertIcon}>⚠</Text>
          <View style={styles.alertCopy}>
            <Text style={styles.alertTitle}>2 evidence packs incomplete</Text>
            <Text style={styles.alertSub}>Review items that need your attention</Text>
          </View>
          <Text style={styles.alertArrow}>›</Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          onPress={() => router.replace('/')}
          style={({ pressed }) => [styles.logoutButton, pressed && styles.pressed]}
        >
          <Text style={styles.logoutText}>Log out</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function QuickAction({
  icon,
  label,
  onPress,
}: {
  icon: string;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.actionButton, pressed && styles.pressed]}
    >
      <Text style={styles.actionIcon}>{icon}</Text>
      <Text style={styles.actionLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, paddingBottom: 36, width: '100%', maxWidth: 640, alignSelf: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 },
  greeting: { color: colors.text, fontSize: 23, fontWeight: '800' },
  headerSub: { color: colors.muted, marginTop: 5, fontSize: 14 },
  sync: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  syncDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.primary },
  syncText: { color: colors.primary, fontSize: 12, fontWeight: '700' },
  sectionTitle: { color: colors.text, fontSize: 18, fontWeight: '800', marginBottom: 13, marginTop: 8 },
  programmeCard: {
    padding: 17,
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 12,
  },
  programmeName: { color: colors.text, fontSize: 16, fontWeight: '700' },
  programmeMeta: { color: colors.muted, fontSize: 13, marginTop: 5 },
  progressList: { marginTop: 17, gap: 13 },
  progressLabelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  progressLabel: { color: colors.muted, fontSize: 12 },
  progressValue: { color: colors.text, fontSize: 12, fontWeight: '700' },
  progressTrack: { height: 7, borderRadius: 4, backgroundColor: '#EDF0EC', overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 4, backgroundColor: colors.primary },
  actionsRow: { flexDirection: 'row', gap: 10, marginBottom: 18 },
  actionButton: {
    flex: 1,
    minHeight: 82,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  actionIcon: { color: colors.primary, fontSize: 22, fontWeight: '700' },
  actionLabel: { color: colors.text, fontSize: 12, fontWeight: '700' },
  alertCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderRadius: 12,
    backgroundColor: '#FFF1D8',
    marginBottom: 22,
  },
  alertIcon: { color: '#A66608', fontSize: 21, marginRight: 12 },
  alertCopy: { flex: 1 },
  alertTitle: { color: '#6E480F', fontSize: 14, fontWeight: '800' },
  alertSub: { color: '#88652F', fontSize: 12, marginTop: 4 },
  alertArrow: { color: '#88652F', fontSize: 25, paddingLeft: 8 },
  logoutButton: { minHeight: 50, borderRadius: 8, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  logoutText: { color: colors.text, fontSize: 15, fontWeight: '700' },
  pressed: { opacity: 0.8 },
});
