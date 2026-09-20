import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Link, router } from "expo-router";
import { useRef, useState } from "react";
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { colors, radius, shadow } from "@/lib/theme";
import { signOutThisDevice } from "@/lib/auth";

const webBaseUrl = process.env.EXPO_PUBLIC_WEB_BASE_URL?.replace(/\/$/, "");

export default function SettingsScreen() {
  const loggingOut = useRef(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function logout() {
    if (loggingOut.current) return;
    loggingOut.current = true;
    setBusy(true);
    const result = await signOutThisDevice();
    if (result.ok) {
      router.dismissAll();
      router.replace("/(auth)/welcome");
      return;
    }
    loggingOut.current = false;
    setBusy(false);
    setMessage(result.message);
  }

  function confirmLogout() {
    Alert.alert("この端末からログアウトしますか？", "クラウドの記録や他の端末のログインは残ります。登録済みの通知は停止しないため、止める場合は端末の設定でこのアプリの通知をオフにしてください。", [
      { text: "キャンセル", style: "cancel" },
      { text: "ログアウトする", style: "destructive", onPress: () => { void logout(); } }
    ]);
  }
  function openPrivacyPolicy() {
    if (!webBaseUrl) return;
    void Linking.openURL(`${webBaseUrl}/legal/privacy`).catch(() => null);
  }

  return (
    <ScrollView contentContainerStyle={styles.screen} style={styles.scroll}>
      <View style={styles.header}>
        <Text style={styles.kicker}>設定</Text>
        <Text style={styles.title}>安心して使うための確認</Text>
        <Text style={styles.body}>通知、プライバシー、削除依頼、利用案内をまとめます。</Text>
      </View>

      <MenuCard
        body="期限が近い手続きと月1回の状況確認だけを、必要な時に受け取ります。"
        href="/notifications"
        icon="bell-check-outline"
        title="通知設定"
      />

      <MenuCard
        body="アプリで何ができるか、登録前の説明画面をもう一度確認します。"
        href="/(auth)/welcome"
        icon="information-outline"
        title="最初の説明を見る"
      />

      <View style={styles.card}>
        <View style={styles.cardTitleRow}>
          <MaterialCommunityIcons color={colors.green} name="shield-lock-outline" size={23} />
          <Text style={styles.cardTitle}>大事な情報の扱い</Text>
        </View>
        <Text style={styles.body}>入院、認知症、死亡などの情報は慎重に扱います。暗証番号、パスワード、マイナンバー画像は保存しないでください。</Text>
        <Pressable style={styles.secondaryButton} onPress={openPrivacyPolicy} disabled={!webBaseUrl}>
          <Text style={styles.secondaryButtonText}>{webBaseUrl ? "プライバシーポリシーを見る" : "プライバシーポリシーは準備中です"}</Text>
        </Pressable>
      </View>

      <MenuCard
        body="登録情報、家族共有、写真、通知設定の削除をアプリ内から依頼できます。"
        href="/account/delete"
        icon="account-remove-outline"
        title="アカウントと削除"
      />

      <MenuCard
        body="無料で使える機能と、AI相談の利用条件を確認します。"
        href="/account/plan"
        icon="clipboard-check-outline"
        title="無料で使える範囲"
      />
      <View style={styles.card}>
        <Text style={styles.cardTitle}>この端末のログイン</Text>
        <Text style={styles.body}>ログアウトしても、クラウドの記録と他の端末のログインは残ります。登録済みの端末通知は自動では停止しません。</Text>
        <Pressable disabled={busy} onPress={confirmLogout} style={styles.secondaryButton}>
          <Text style={styles.secondaryButtonText}>{busy ? "ログアウトしています…" : "この端末からログアウト"}</Text>
        </Pressable>
        {message ? <Text style={styles.body}>{message}</Text> : null}
      </View>
    </ScrollView>
  );
}

function MenuCard({
  body,
  href,
  icon,
  title
}: {
  body: string;
  href: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  title: string;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.cardTitleRow}>
        <MaterialCommunityIcons color={colors.green} name={icon} size={23} />
        <Text style={styles.cardTitle}>{title}</Text>
      </View>
      <Text style={styles.body}>{body}</Text>
      <Link href={href} style={styles.primaryLink}>開く</Link>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { backgroundColor: colors.paper, flex: 1 },
  screen: { gap: 14, padding: 18, paddingBottom: 32 },
  header: { gap: 6, paddingTop: 8 },
  kicker: { color: colors.green, fontWeight: "900" },
  title: { color: colors.ink, fontSize: 32, fontWeight: "900", lineHeight: 37 },
  body: { color: colors.muted, lineHeight: 22 },
  card: { backgroundColor: colors.surface, borderColor: colors.line, borderRadius: radius.card, borderWidth: 1, gap: 12, padding: 16, ...shadow },
  cardTitleRow: { alignItems: "center", flexDirection: "row", gap: 8 },
  cardTitle: { color: colors.ink, flex: 1, fontSize: 20, fontWeight: "900", lineHeight: 25 },
  primaryLink: { backgroundColor: colors.green, borderRadius: radius.control, color: "#fff", fontWeight: "900", overflow: "hidden", paddingHorizontal: 14, paddingVertical: 12, textAlign: "center" },
  secondaryButton: { alignItems: "center", backgroundColor: colors.surface, borderColor: colors.line, borderRadius: radius.control, borderWidth: 1, justifyContent: "center", minHeight: 48 },
  secondaryButtonText: { color: colors.ink, fontWeight: "900", textAlign: "center" }
});
