import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { FREE_PLAN_MEMBER_LIMIT } from "@oyano/shared";
import { fetchDashboardData } from "@/lib/mobileData";
import { colors, radius, shadow } from "@/lib/theme";

const rows = [
  ["現在のプラン", "Free"],
  ["親の登録", "1名"],
  ["家族招待", `あなたのほかに${FREE_PLAN_MEMBER_LIMIT}人まで`],
  ["期限通知", "基本通知あり"],
  ["写真", "10枚目安"],
  ["AI相談", "初回1回だけ無料"]
];

export default function AccountPlanScreen() {
  const [allComplete, setAllComplete] = useState(false);

  useEffect(() => {
    let mounted = true;
    void fetchDashboardData().then((data) => {
      if (!mounted) return;
      setAllComplete(data.tasks.length > 0 && data.tasks.every((task) => task.status === "done" || task.status === "skipped"));
    });
    return () => { mounted = false; };
  }, []);

  return (
    <ScrollView contentContainerStyle={styles.screen} style={styles.scroll}>
      <View style={styles.header}>
        <Text style={styles.kicker}>プラン確認</Text>
        <Text style={styles.title}>利用状態の詳細</Text>
        <Text style={styles.body}>現在使える範囲と、サポートの進行状況を確認します。</Text>
      </View>

      <View style={styles.card}>
        <View style={styles.cardTitleRow}>
          <MaterialCommunityIcons color={colors.green} name="clipboard-check-outline" size={23} />
          <Text style={styles.cardTitle}>現在の状態</Text>
        </View>
        {rows.map(([label, value]) => (
          <View key={label} style={styles.row}>
            <Text style={styles.label}>{label}</Text>
            <Text style={styles.value}>{value}</Text>
          </View>
        ))}
      </View>

      <View style={styles.card}>
        <View style={styles.cardTitleRow}>
          <MaterialCommunityIcons color={colors.green} name="package-variant-closed" size={23} />
          <Text style={styles.cardTitle}>Family Plus</Text>
        </View>
        <Text style={styles.body}>月額980円・年額9,800円。2人目以降、家族招待の追加、写真・PDF容量、長期相談を広げます。</Text>
        <Text style={styles.body}>アプリでは利用状態だけを表示します。外部決済への案内は置きません。</Text>
        <View style={styles.statusPill}>
          <Text style={styles.statusPillText}>解約しても基本の記録は読めます</Text>
        </View>
      </View>

      {allComplete ? (
        <View style={styles.completeNotice}>
          <Text style={styles.noticeTitle}>一区切りついたら</Text>
          <Text style={styles.noticeText}>すべての確認が終わった家族は、Plusを続けるか見直せます。手帳の基本記録は読み返せる前提で設計します。</Text>
        </View>
      ) : null}

      <View style={styles.notice}>
        <Text style={styles.noticeTitle}>表示方針</Text>
        <Text style={styles.noticeText}>ここでは受付済みの内容や利用状態だけを表示します。家族が混乱しないよう、操作は状態確認に絞っています。</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { backgroundColor: colors.paper, flex: 1 },
  screen: { gap: 14, padding: 18, paddingBottom: 32 },
  header: { gap: 6, paddingTop: 8 },
  kicker: { color: colors.green, fontWeight: "900" },
  title: { color: colors.ink, fontSize: 30, fontWeight: "900", lineHeight: 36 },
  card: { backgroundColor: colors.surface, borderColor: colors.line, borderRadius: radius.card, borderWidth: 1, gap: 10, padding: 16, ...shadow },
  cardTitleRow: { alignItems: "center", flexDirection: "row", gap: 8 },
  cardTitle: { color: colors.ink, flex: 1, fontSize: 20, fontWeight: "900", lineHeight: 25 },
  row: { borderBottomColor: "#edf1ed", borderBottomWidth: 1, gap: 4, paddingBottom: 10 },
  label: { color: colors.green, fontWeight: "900" },
  value: { color: colors.ink, fontWeight: "800", lineHeight: 22 },
  body: { color: colors.muted, lineHeight: 22 },
  statusPill: { alignSelf: "flex-start", backgroundColor: colors.surfaceSoft, borderColor: colors.line, borderRadius: 999, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 7 },
  statusPillText: { color: colors.greenDark, fontSize: 12, fontWeight: "900" },
  completeNotice: { backgroundColor: "#eef8ef", borderColor: "#cfe6d4", borderRadius: radius.card, borderWidth: 1, gap: 6, padding: 14 },
  notice: { backgroundColor: "#fff9eb", borderColor: "#ead9b8", borderRadius: radius.card, borderWidth: 1, gap: 6, padding: 14 },
  noticeTitle: { color: colors.greenDark, fontSize: 18, fontWeight: "900" },
  noticeText: { color: "#6f532b", fontWeight: "800", lineHeight: 22 }
});
