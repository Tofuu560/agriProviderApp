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

const providers = [
  { name: 'Provider X', programme: 'Emerging Farmers Programme', due: 'Due today', flagged: '2 flagged items' },
  { name: 'Green Valley Co-op', programme: 'Sustainable Agriculture', due: 'Due tomorrow', flagged: '1 flagged item' },
  { name: 'Ubuntu Growers', programme: 'Agri-business Foundations', due: 'Due in 3 days', flagged: '4 flagged items' },
];

export default function QAScreen() {
  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>QUALITY ASSURANCE</Text>
            <Text style={styles.title}>QA Workspace</Text>
          </View>
          <View style={styles.headerIcon}><Text style={styles.headerIconText}>✓</Text></View>
        </View>

        <View style={styles.kpiRow}>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Pending Audits</Text>
            <Text style={styles.kpiValue}>08</Text>
            <Text style={styles.kpiMeta}>Across 5 programmes</Text>
          </View>
          <View style={[styles.kpiCard, styles.flaggedCard]}>
            <Text style={styles.kpiLabel}>Flagged Evidence</Text>
            <Text style={[styles.kpiValue, styles.flaggedValue]}>03</Text>
            <Text style={styles.kpiMeta}>Needs attention</Text>
          </View>
        </View>

        <View style={styles.listTitleRow}>
          <Text style={styles.sectionTitle}>Providers requiring review</Text>
          <Text style={styles.queueCount}>3</Text>
        </View>
        <View style={styles.providers}>
          {providers.map((provider, index) => (
            <Pressable
              accessibilityRole="button"
              key={provider.name}
              onPress={() => router.push('/qa-audit')}
              style={({ pressed }) => [styles.providerCard, pressed && styles.pressed]}
            >
              <View style={styles.providerTop}>
                <View style={styles.providerAvatar}>
                  <Text style={styles.providerInitial}>{provider.name.charAt(0)}</Text>
                </View>
                <View style={styles.providerDetails}>
                  <Text style={styles.providerName}>{provider.name}</Text>
                  <Text style={styles.programme}>{provider.programme}</Text>
                </View>
                <Text style={styles.chevron}>›</Text>
              </View>
              <View style={styles.providerBottom}>
                <View style={styles.dueBadge}>
                  <Text style={styles.dueText}>{provider.due}</Text>
                </View>
                <Text style={styles.flagText}>{provider.flagged}</Text>
              </View>
              {index === 0 && <View style={styles.priorityMark} />}
            </Pressable>
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
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 },
  eyebrow: { color: colors.primary, fontSize: 10, letterSpacing: 1.3, fontWeight: '800', marginBottom: 6 },
  title: { color: colors.text, fontSize: 25, fontWeight: '800' },
  headerIcon: { height: 46, width: 46, borderRadius: 15, backgroundColor: '#EAF2EB', alignItems: 'center', justifyContent: 'center' },
  headerIconText: { color: colors.primary, fontSize: 22, fontWeight: '800' },
  kpiRow: { flexDirection: 'row', gap: 12, marginBottom: 26 },
  kpiCard: { flex: 1, minHeight: 138, padding: 16, borderRadius: 12, backgroundColor: colors.primary },
  flaggedCard: { backgroundColor: '#FFF1D8' },
  kpiLabel: { color: '#EAF2EB', fontSize: 12, fontWeight: '700' },
  kpiValue: { color: colors.card, fontSize: 33, fontWeight: '800', marginTop: 13 },
  flaggedValue: { color: '#8C5D12' },
  kpiMeta: { color: '#EAF2EB', fontSize: 11, marginTop: 2 },
  listTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 13 },
  sectionTitle: { color: colors.text, fontSize: 17, fontWeight: '800' },
  queueCount: { color: colors.primary, backgroundColor: '#EAF2EB', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4, fontSize: 12, fontWeight: '800' },
  providers: { gap: 11 },
  providerCard: { backgroundColor: colors.card, borderRadius: 12, padding: 15, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  providerTop: { flexDirection: 'row', alignItems: 'center' },
  providerAvatar: { width: 42, height: 42, borderRadius: 14, backgroundColor: '#F0F3EF', alignItems: 'center', justifyContent: 'center' },
  providerInitial: { color: colors.primary, fontSize: 17, fontWeight: '800' },
  providerDetails: { flex: 1, marginLeft: 11 },
  providerName: { color: colors.text, fontSize: 14, fontWeight: '800' },
  programme: { color: colors.muted, fontSize: 11, marginTop: 4 },
  chevron: { color: colors.muted, fontSize: 25, paddingLeft: 8 },
  providerBottom: { marginTop: 14, paddingTop: 11, borderTopWidth: 1, borderTopColor: '#F0F2EF', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dueBadge: { backgroundColor: '#F3F5F2', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 5 },
  dueText: { color: colors.muted, fontSize: 11, fontWeight: '700' },
  flagText: { color: '#A45D20', fontSize: 11, fontWeight: '700' },
  priorityMark: { width: 3, backgroundColor: colors.amber, position: 'absolute', top: 0, bottom: 0, left: 0 },
  logoutButton: { minHeight: 50, borderRadius: 8, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', marginTop: 24 },
  logoutText: { color: colors.text, fontSize: 15, fontWeight: '700' },
  pressed: { opacity: 0.78 },
});
