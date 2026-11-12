import { router } from 'expo-router';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const colors = {
  primary: '#1F6B3A',
  danger: '#C8442B',
  amber: '#F2A93B',
  background: '#F7F8F5',
  card: '#FFFFFF',
  text: '#1A1A1A',
  muted: '#727A73',
  border: '#E5E9E3',
};

const checks = [
  { label: 'Enrolment', detail: 'Learner records verified', state: 'complete' },
  { label: 'Attendance', detail: 'Minimum attendance threshold met', state: 'complete' },
  { label: 'Certification', detail: 'Evidence pack needs review', state: 'attention' },
] as const;

export default function QAAuditScreen() {
  function unlockMilestone() {
    Alert.alert('Milestone unlocked', 'Provider X can proceed to the next milestone.');
  }

  function requestReupload() {
    Alert.alert(
      'Request re-upload',
      'Provider X will be asked to correct and re-upload the flagged evidence.',
    );
  }

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <View style={styles.screen}>
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back to QA Workspace"
            onPress={() => router.back()}
            style={styles.backButton}
          >
            <Text style={styles.backText}>‹</Text>
          </Pressable>
          <View style={styles.headerCopy}>
            <Text style={styles.eyebrow}>FINAL GATE</Text>
            <Text style={styles.title}>Audit — Provider X</Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.summaryCard}>
            <View style={styles.summaryIcon}><Text style={styles.summaryIconText}>PX</Text></View>
            <View style={styles.summaryCopy}>
              <Text style={styles.providerName}>Provider X</Text>
              <Text style={styles.programme}>Emerging Farmers Programme</Text>
            </View>
            <View style={styles.reviewBadge}><Text style={styles.reviewText}>In review</Text></View>
          </View>

          <Text style={styles.sectionTitle}>Milestone condition checklist</Text>
          <View style={styles.checklist}>
            {checks.map((check, index) => {
              const attention = check.state === 'attention';
              return (
                <View key={check.label} style={styles.checkRow}>
                  <View style={[styles.checkIcon, attention && styles.attentionIcon]}>
                    <Text style={[styles.checkMark, attention && styles.attentionMark]}>
                      {attention ? '!' : '✓'}
                    </Text>
                  </View>
                  <View style={styles.checkCopy}>
                    <Text style={styles.checkLabel}>{check.label}</Text>
                    <Text style={styles.checkDetail}>{check.detail}</Text>
                  </View>
                  <Text style={[styles.checkStatus, attention && styles.attentionStatus]}>
                    {attention ? 'Review' : 'Passed'}
                  </Text>
                  {index < checks.length - 1 && <View style={styles.divider} />}
                </View>
              );
            })}
          </View>

          <View style={styles.notice}>
            <Text style={styles.noticeIcon}>i</Text>
            <Text style={styles.noticeText}>
              Unlocking this milestone confirms all conditions have been reviewed by QA.
            </Text>
          </View>
        </ScrollView>

        <SafeAreaView edges={['bottom']} style={styles.footer}>
          <Pressable
            accessibilityRole="button"
            onPress={unlockMilestone}
            style={({ pressed }) => [styles.unlockButton, pressed && styles.pressed]}
          >
            <Text style={styles.unlockText}>Unlock Milestone</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={requestReupload}
            style={({ pressed }) => [styles.rejectButton, pressed && styles.pressed]}
          >
            <Text style={styles.rejectText}>Reject / Request Re-upload</Text>
          </Pressable>
        </SafeAreaView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  screen: { flex: 1, width: '100%', maxWidth: 640, alignSelf: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 10, paddingBottom: 17 },
  backButton: { width: 48, height: 48, borderRadius: 14, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border },
  backText: { color: colors.text, fontSize: 30, lineHeight: 34, marginTop: -4 },
  headerCopy: { marginLeft: 12, flex: 1 },
  eyebrow: { color: colors.primary, fontSize: 10, fontWeight: '800', letterSpacing: 1.2, marginBottom: 3 },
  title: { color: colors.text, fontSize: 20, fontWeight: '800' },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 22 },
  summaryCard: { backgroundColor: colors.card, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: colors.border, flexDirection: 'row', alignItems: 'center', marginBottom: 26 },
  summaryIcon: { width: 46, height: 46, borderRadius: 15, backgroundColor: '#EAF2EB', alignItems: 'center', justifyContent: 'center' },
  summaryIconText: { color: colors.primary, fontWeight: '800', fontSize: 14 },
  summaryCopy: { flex: 1, marginLeft: 12 },
  providerName: { color: colors.text, fontSize: 15, fontWeight: '800' },
  programme: { color: colors.muted, fontSize: 11, marginTop: 4 },
  reviewBadge: { backgroundColor: '#FFF1D8', borderRadius: 14, paddingHorizontal: 9, paddingVertical: 6 },
  reviewText: { color: '#805612', fontSize: 10, fontWeight: '800' },
  sectionTitle: { color: colors.text, fontSize: 17, fontWeight: '800', marginBottom: 12 },
  checklist: { backgroundColor: colors.card, borderRadius: 12, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 15 },
  checkRow: { minHeight: 76, flexDirection: 'row', alignItems: 'center', position: 'relative' },
  checkIcon: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#EAF2EB', alignItems: 'center', justifyContent: 'center' },
  attentionIcon: { backgroundColor: '#FFF1D8' },
  checkMark: { color: colors.primary, fontSize: 15, fontWeight: '800' },
  attentionMark: { color: '#A66608' },
  checkCopy: { flex: 1, marginLeft: 11 },
  checkLabel: { color: colors.text, fontSize: 14, fontWeight: '700' },
  checkDetail: { color: colors.muted, fontSize: 11, marginTop: 4 },
  checkStatus: { color: colors.primary, fontSize: 11, fontWeight: '700' },
  attentionStatus: { color: '#A66608' },
  divider: { height: 1, backgroundColor: '#EEF0EC', position: 'absolute', bottom: 0, left: 41, right: 0 },
  notice: { flexDirection: 'row', alignItems: 'flex-start', marginTop: 17, padding: 14, borderRadius: 10, backgroundColor: '#EDF3EE' },
  noticeIcon: { height: 19, width: 19, borderRadius: 10, overflow: 'hidden', textAlign: 'center', color: colors.primary, borderWidth: 1, borderColor: colors.primary, fontSize: 12, fontWeight: '800', marginRight: 9 },
  noticeText: { flex: 1, color: '#435749', fontSize: 12, lineHeight: 18 },
  footer: { paddingHorizontal: 20, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.background, gap: 9 },
  unlockButton: { minHeight: 52, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary },
  unlockText: { color: colors.card, fontSize: 15, fontWeight: '800' },
  rejectButton: { minHeight: 52, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.card, borderWidth: 1, borderColor: colors.danger },
  rejectText: { color: colors.danger, fontSize: 14, fontWeight: '800' },
  pressed: { opacity: 0.78 },
});
