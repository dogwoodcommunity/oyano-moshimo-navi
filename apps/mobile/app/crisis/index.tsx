import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { CRISIS_EMERGENCY_NOTE, CRISIS_SAFETY_NOTE, crisisScenarios } from "@oyano/shared";
import { colors, radius, shadow } from "@/lib/theme";

export default function CrisisIndexScreen() {
  // Link asChild は子へ style を渡すため、Pressable の関数形式の style が壊れる。
  // 押した時の反応を残すため、遷移は router.push で行う。
  const router = useRouter();

  return (
    <ScrollView contentContainerStyle={styles.content} style={styles.screen}>
      <View style={styles.hero}>
        <Text style={styles.kicker}>急なときに開く</Text>
        <Text style={styles.title}>いま起きていることを選んでください。</Text>
        <Text style={styles.lead}>
          今から必要なことだけを、順番に出します。読み物ではありません。登録も入力もいりません。
        </Text>
        <View style={styles.emergency}>
          <MaterialCommunityIcons color={colors.rose} name="phone-alert-outline" size={20} />
          <Text style={styles.emergencyText}>{CRISIS_EMERGENCY_NOTE}</Text>
        </View>
      </View>

      <View style={styles.choices}>
        {crisisScenarios.map((scenario) => (
          <Pressable
            key={scenario.key}
            onPress={() => router.push(`/crisis/${scenario.key}`)}
            style={({ pressed }) => [styles.choice, pressed && styles.choicePressed]}
          >
            <View style={styles.choiceBody}>
              <Text style={styles.choiceTitle}>{scenario.label}</Text>
              <Text style={styles.choiceHint}>{scenario.situation}</Text>
            </View>
            <MaterialCommunityIcons color={colors.clay} name="chevron-right" size={26} />
          </Pressable>
        ))}
      </View>

      <View style={styles.note}>
        <Text style={styles.noteTitle}>どれにも当てはまらない時は</Text>
        <Text style={styles.noteBody}>
          まだ急ぎではない、でも不安があるという時は、対象者を1人登録して記録を残すところから始められます。
        </Text>
        <Pressable onPress={() => router.push("/(tabs)/dashboard")} style={styles.noteButton}>
          <Text style={styles.noteButtonText}>家族ボードへ</Text>
        </Pressable>
      </View>

      <Text style={styles.safety}>{CRISIS_SAFETY_NOTE}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.paper },
  content: { gap: 16, padding: 20, paddingBottom: 48 },
  hero: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: radius.card,
    borderWidth: 1,
    gap: 10,
    padding: 20,
    ...shadow
  },
  kicker: { color: colors.clay, fontSize: 12, fontWeight: "900", letterSpacing: 1 },
  title: { color: colors.ink, fontSize: 24, fontWeight: "900", lineHeight: 34 },
  lead: { color: colors.muted, fontSize: 14, lineHeight: 24 },
  emergency: {
    alignItems: "flex-start",
    backgroundColor: "#f7e7e2",
    borderRadius: radius.control,
    flexDirection: "row",
    gap: 10,
    marginTop: 4,
    padding: 14
  },
  emergencyText: { color: "#8d3f2c", flex: 1, fontSize: 13, fontWeight: "700", lineHeight: 21 },
  choices: { gap: 12 },
  choice: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: "#e2c7b6",
    borderRadius: radius.card,
    borderWidth: 1.5,
    flexDirection: "row",
    gap: 12,
    minHeight: 88,
    padding: 18,
    ...shadow
  },
  choicePressed: { backgroundColor: "#f7ede6" },
  choiceBody: { flex: 1, gap: 4 },
  choiceTitle: { color: colors.ink, fontSize: 19, fontWeight: "900" },
  choiceHint: { color: colors.muted, fontSize: 13, lineHeight: 20 },
  note: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: radius.card,
    borderWidth: 1,
    gap: 8,
    padding: 18
  },
  noteTitle: { color: colors.ink, fontSize: 16, fontWeight: "900" },
  noteBody: { color: colors.muted, fontSize: 13.5, lineHeight: 22 },
  noteButton: {
    alignItems: "center",
    borderColor: colors.green,
    borderRadius: 999,
    borderWidth: 1.5,
    marginTop: 4,
    paddingVertical: 12
  },
  noteButtonText: { color: colors.green, fontSize: 15, fontWeight: "900" },
  safety: { color: colors.muted, fontSize: 12, lineHeight: 20 }
});
