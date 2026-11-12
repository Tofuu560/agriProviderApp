import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const colors = {
  primary: '#1F6B3A',
  amber: '#F2A93B',
  background: '#F7F8F5',
  card: '#FFFFFF',
  text: '#1A1A1A',
  muted: '#727A73',
  border: '#E5E9E3',
};

const cohorts = [
  { name: 'Emerging Farmers · Cohort 04', learners: '12 learners', date: 'Today, 10:00 AM', color: '#EAF2EB' },
  { name: 'Sustainable Agriculture · Cohort 02', learners: '8 learners', date: 'Today, 1:30 PM', color: '#FFF1D8' },
  { name: 'Agri-business Foundations · Cohort 01', learners: '16 learners', date: 'Tomorrow, 9:00 AM', color: '#EEF0FA' },
];

const moderation = [
  { time: '2:30 PM', title: 'Practical assessment review', detail: 'Emerging Farmers · Cohort 03' },
  { time: 'Thu, 11:00 AM', title: 'Portfolio moderation', detail: 'Sustainable Agriculture · Cohort 01' },
];

export default function AssessorScreen() {
  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>ASSESSOR</Text>
            <Text style={styles.title}>Assessor Portal</Text>
            <Text style={styles.subtitle}>Your assessment day at a glance</Text>
          </View>
          <View style={styles.profile}><Text style={styles.profileText}>AS</Text></View>
        </View>

        <View style={styles.summaryStrip}>
          <View>
            <Text style={styles.summaryNumber}>3</Text>
            <Text style={styles.summaryLabel}>Cohorts today</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View>
            <Text style={styles.summaryNumber}>36</Text>
            <Text style={styles.summaryLabel}>Learners scheduled</Text>
          </View>
          <View style={styles.summaryIcon}><Text style={styles.calendarIcon}>▦</Text></View>
        </View>

        <View style={styles.sectionHeading}>
          <Text style={styles.sectionTitle}>Pending Assessments</Text>
          <Text style={styles.seeAll}>View all</Text>
        </View>
        <View style={styles.cohortList}>
          {cohorts.map((cohort, index) => (
            <View key={cohort.name} style={styles.cohortCard}>
              <View style={[styles.cohortMarker, { backgroundColor: cohort.color }]}>
                <Text style={[styles.markerText, index === 1 && styles.amberMarker]}>A{index + 1}</Text>
              </View>
              <View style={styles.cohortDetails}>
                <Text style={styles.cohortName}>{cohort.name}</Text>
                <Text style={styles.cohortLearners}>{cohort.learners}</Text>
                <View style={styles.dateRow}>
                  <Text style={styles.clock}>◷</Text>
                  <Text style={styles.cohortDate}>{cohort.date}</Text>
                </View>
              </View>
              <Text style={styles.chevron}>›</Text>
            </View>
          ))}
        </View>

        <View style={styles.sectionHeading}>
          <Text style={styles.sectionTitle}>Moderation Schedule</Text>
          <View style={styles.weekBadge}><Text style={styles.weekBadgeText}>THIS WEEK</Text></View>
        </View>
        <View style={styles.moderationCard}>
          {moderation.map((item, index) => (
            <View key={item.title} style={styles.moderationRow}>
              <View style={styles.timeColumn}>
                <Text style={styles.moderationTime}>{item.time}</Text>
                <View style={styles.timelineDot} />
                {index < moderation.length - 1 && <View style={styles.timelineLine} />}
              </View>
              <View style={styles.moderationDetails}>
                <Text style={styles.moderationTitle}>{item.title}</Text>
                <Text style={styles.moderationSub}>{item.detail}</Text>
              </View>
            </View>
          ))}
        </View>

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

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, paddingBottom: 36, width: '100%', maxWidth: 640, alignSelf: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 21 },
  eyebrow: { color: colors.primary, fontSize: 10, fontWeight: '800', letterSpacing: 1.3, marginBottom: 6 },
  title: { color: colors.text, fontSize: 25, fontWeight: '800' },
  subtitle: { color: colors.muted, fontSize: 13, marginTop: 5 },
  profile: { height: 46, width: 46, borderRadius: 16, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  profileText: { color: colors.card, fontWeight: '800', fontSize: 14 },
  summaryStrip: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.primary, borderRadius: 12, padding: 17, marginBottom: 26 },
  summaryNumber: { color: colors.card, fontSize: 23, fontWeight: '800' },
  summaryLabel: { color: '#DCEADF', fontSize: 10, marginTop: 3 },
  summaryDivider: { height: 36, width: 1, backgroundColor: '#FFFFFF45', marginHorizontal: 22 },
  summaryIcon: { marginLeft: 'auto', height: 42, width: 42, borderRadius: 13, backgroundColor: '#FFFFFF20', alignItems: 'center', justifyContent: 'center' },
  calendarIcon: { color: colors.card, fontSize: 22 },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, marginTop: 3 },
  sectionTitle: { color: colors.text, fontSize: 17, fontWeight: '800' },
  seeAll: { color: colors.primary, fontSize: 12, fontWeight: '700' },
  cohortList: { gap: 10, marginBottom: 25 },
  cohortCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderRadius: 12, borderWidth: 1, borderColor: colors.border, padding: 13 },
  cohortMarker: { width: 43, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  markerText: { color: colors.primary, fontSize: 12, fontWeight: '800' },
  amberMarker: { color: '#8C5D12' },
  cohortDetails: { flex: 1, marginLeft: 12 },
  cohortName: { color: colors.text, fontSize: 13, fontWeight: '800' },
  cohortLearners: { color: colors.muted, fontSize: 11, marginTop: 4 },
  dateRow: { flexDirection: 'row', alignItems: 'center', marginTop: 7 },
  clock: { color: colors.primary, fontSize: 15, marginRight: 5 },
  cohortDate: { color: colors.primary, fontSize: 11, fontWeight: '700' },
  chevron: { color: colors.muted, fontSize: 24, paddingLeft: 6 },
  weekBadge: { backgroundColor: '#EAF2EB', borderRadius: 12, paddingHorizontal: 9, paddingVertical: 5 },
  weekBadgeText: { color: colors.primary, fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
  moderationCard: { backgroundColor: colors.card, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 5, borderWidth: 1, borderColor: colors.border },
  moderationRow: { minHeight: 72, flexDirection: 'row', alignItems: 'center' },
  timeColumn: { width: 76, height: '100%', justifyContent: 'center' },
  moderationTime: { color: colors.primary, fontSize: 10, fontWeight: '800' },
  timelineDot: { position: 'absolute', right: 7, top: '50%', marginTop: -4, height: 8, width: 8, borderRadius: 4, backgroundColor: colors.amber },
  timelineLine: { position: 'absolute', right: 10, top: '50%', bottom: -16, width: 1, backgroundColor: '#E7EAE5' },
  moderationDetails: { flex: 1, borderLeftWidth: 1, borderLeftColor: '#E7EAE5', paddingLeft: 13, paddingVertical: 12 },
  moderationTitle: { color: colors.text, fontSize: 12, fontWeight: '800' },
  moderationSub: { color: colors.muted, fontSize: 10, marginTop: 5 },
  logoutButton: { minHeight: 50, borderRadius: 8, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', marginTop: 24 },
  logoutText: { color: colors.text, fontSize: 15, fontWeight: '700' },
  pressed: { opacity: 0.78 },
});
