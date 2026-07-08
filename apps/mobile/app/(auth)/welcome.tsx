import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { Image, Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { demoResult } from "@/lib/demoData";
import { activateDemoSession } from "@/lib/demoSession";
import { sendMagicLink } from "@/lib/auth";
import { consumeWebHandoff } from "@/lib/handoff";
import { colors, radius, shadow } from "@/lib/theme";

type AuthMode = "signup" | "login";

const webBaseUrl = process.env.EXPO_PUBLIC_WEB_BASE_URL?.replace(/\/$/, "");

export default function WelcomeScreen() {
  const params = useLocalSearchParams<{ caseId?: string; token?: string }>();
  const [authMode, setAuthMode] = useState<AuthMode | null>(null);
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const caseId = typeof params.caseId === "string" ? params.caseId : undefined;
  const token = typeof params.token === "string" ? params.token : undefined;
  const hasHandoff = Boolean(caseId && token && caseId !== "demo" && token !== "demo");
  const authTitle = authMode === "login" ? "登録済みの方のログイン" : "新規会員登録";

  async function continueToApp() {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setMessage("メールアドレスを入力してください。");
      return;
    }

    const redirectPath = hasHandoff
      ? `/handoff?${new URLSearchParams({ caseId: caseId ?? "", token: token ?? "" }).toString()}`
      : undefined;
    const result = await sendMagicLink(trimmedEmail, redirectPath);
    setMessage(result.message);

    if (result.sent) return;

    const handoff = await consumeWebHandoff(caseId, token);
    if (handoff) {
      setMessage(`Web診断を引き継ぎました。タスク ${handoff.tasksCreated}件`);
    }
    router.replace("/(tabs)/dashboard");
  }

  async function continueDemo() {
    activateDemoSession();
    setMessage(`見本で開きます。確認用タスク ${demoResult.tasks.length}件を表示します。`);
    router.replace("/(tabs)/dashboard");
  }

  function openAuth(mode: AuthMode) {
    setAuthMode(mode);
    setMessage("");
  }

  function openWebStart() {
    if (!webBaseUrl) return;
    void Linking.openURL(`${webBaseUrl}/start`);
  }

  return (
    <ScrollView contentContainerStyle={styles.screen} style={styles.scroll} keyboardShouldPersistTaps="handled">
      <View style={styles.photoWrap}>
        <Image
          resizeMode="cover"
          source={require("../../assets/onboarding-family-home.png")}
          style={styles.photo}
        />
      </View>

      <View style={styles.hero}>
        <View style={styles.brandRow}>
          <Text style={styles.brand}>親のもしもナビ</Text>
          <Text style={styles.tag}>家族の保管庫・通知係</Text>
        </View>
        <Text style={styles.title}>親のことで、家族が迷わないように。</Text>
        <Text style={styles.lead}>
          入院、認知症、相続、実家整理。必要なことを整理して、期限と担当を家族で共有します。
        </Text>
      </View>

      {hasHandoff ? (
        <View style={styles.handoffBox}>
          <MaterialCommunityIcons color={colors.greenDark} name="file-check-outline" size={22} />
          <View style={styles.handoffText}>
            <Text style={styles.handoffTitle}>Webの整理結果を保存できます</Text>
            <Text style={styles.body}>会員登録後、診断結果とタスクを家族ボードに引き継ぎます。</Text>
          </View>
        </View>
      ) : null}

      <View style={styles.startPanel}>
        <Text style={styles.startTitle}>もっと詳しく使いたい方へ</Text>
        <Text style={styles.body}>まず内容を見て、家族で続けて管理したいと思った時に会員登録できます。</Text>
        <Pressable onPress={() => openAuth("signup")} style={styles.primaryButton}>
          <Text style={styles.primaryButtonText}>ここから新規会員登録</Text>
          <MaterialCommunityIcons color="#fff" name="arrow-right" size={20} />
        </Pressable>
        <Pressable disabled={!webBaseUrl} onPress={openWebStart} style={[styles.webButton, !webBaseUrl && styles.disabledButton]}>
          <MaterialCommunityIcons color={colors.greenDark} name="web" size={20} />
          <Text style={styles.webButtonText}>登録せずにWebで状況を整理する</Text>
        </Pressable>
        <Pressable onPress={continueDemo} style={styles.previewButton}>
          <MaterialCommunityIcons color={colors.greenDark} name="eye-outline" size={20} />
          <Text style={styles.previewButtonText}>登録前に見本を見る</Text>
        </Pressable>
        <Pressable onPress={() => openAuth("login")} style={styles.loginButton}>
          <Text style={styles.loginText}>登録済みの方はログイン</Text>
        </Pressable>
      </View>

      <View style={styles.noteBand}>
        <MaterialCommunityIcons color={colors.gold} name="bell-check-outline" size={24} />
        <Text style={styles.noteBandText}>毎日開かせるアプリではありません。必要な時に、家族が戻ってこられる場所です。</Text>
      </View>

      <View style={styles.storyPanel}>
        <Text style={styles.sectionTitle}>会員登録するとできること</Text>
        <FeatureRow
          icon="calendar-clock"
          text="法定期限や手続きの期日"
          title="忘れたくない期限"
        />
        <FeatureRow
          icon="account-switch-outline"
          text="誰がやるか決まっていないこと"
          title="家族の担当"
        />
        <FeatureRow
          icon="image-multiple-outline"
          text="書類の場所、写真、実家のメモ"
          title="あとで必要になる記録"
        />
      </View>

      <View style={styles.safePanel}>
        <View style={styles.safeHeader}>
          <MaterialCommunityIcons color={colors.greenDark} name="shield-check-outline" size={24} />
          <Text style={styles.safeTitle}>保存しないものも明確にします</Text>
        </View>
        <Text style={styles.body}>銀行暗証番号、各種パスワード、マイナンバー画像は保存しません。残すのは「存在」と「保管場所」と「家族で確認すること」です。</Text>
      </View>

      {authMode ? (
        <View style={styles.authPanel}>
          <Text style={styles.authTitle}>{authTitle}</Text>
          <Text style={styles.authLead}>パスワードは使いません。メールに届く確認リンクから入れます。</Text>
          <TextInput
            autoCapitalize="none"
            inputMode="email"
            onChangeText={setEmail}
            placeholder="mail@example.com"
            placeholderTextColor="#8a958f"
            style={styles.input}
            value={email}
          />
          <Pressable onPress={continueToApp} style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>{hasHandoff ? "確認メールを送って保存する" : "確認メールを送る"}</Text>
            <MaterialCommunityIcons color="#fff" name="email-fast-outline" size={20} />
          </Pressable>
          <View style={styles.privacyNote}>
            <MaterialCommunityIcons color={colors.greenDark} name="shield-check-outline" size={20} />
            <Text style={styles.privacyText}>
              親の入院、認知症、死亡などの情報は、家族の支援に必要な範囲だけ保存してください。暗証番号やパスワードは保存しません。
            </Text>
          </View>
          {message ? <Text style={styles.message}>{message}</Text> : null}
        </View>
      ) : null}
    </ScrollView>
  );
}

function FeatureRow({
  icon,
  text,
  title
}: {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  text: string;
  title: string;
}) {
  return (
    <View style={styles.featureRow}>
      <View style={styles.iconWrap}>
        <MaterialCommunityIcons color={colors.greenDark} name={icon} size={24} />
      </View>
      <View style={styles.featureText}>
        <Text style={styles.featureTitle}>{title}</Text>
        <Text style={styles.body}>{text}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { backgroundColor: colors.paper, flex: 1 },
  screen: { gap: 16, padding: 18, paddingBottom: 36, paddingTop: 18 },
  photoWrap: { backgroundColor: "#efe8da", borderRadius: radius.card, height: 270, overflow: "hidden", ...shadow },
  photo: { height: "100%", width: "100%" },
  hero: { gap: 10, paddingHorizontal: 2 },
  brandRow: { alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: 8 },
  brand: { backgroundColor: colors.greenDark, borderRadius: 999, color: "#fff", fontSize: 13, fontWeight: "900", overflow: "hidden", paddingHorizontal: 12, paddingVertical: 6 },
  tag: { color: colors.greenDark, fontSize: 13, fontWeight: "900" },
  title: { color: colors.ink, fontSize: 33, fontWeight: "900", lineHeight: 40 },
  lead: { color: colors.muted, fontSize: 16, lineHeight: 26 },
  handoffBox: { alignItems: "flex-start", backgroundColor: colors.surfaceSoft, borderColor: colors.line, borderRadius: radius.card, borderWidth: 1, flexDirection: "row", gap: 10, padding: 14 },
  handoffText: { flex: 1, gap: 4 },
  handoffTitle: { color: colors.greenDark, fontSize: 16, fontWeight: "900", lineHeight: 22 },
  startPanel: { backgroundColor: colors.surface, borderColor: colors.line, borderRadius: radius.card, borderWidth: 1, gap: 10, padding: 16, ...shadow },
  startTitle: { color: colors.ink, fontSize: 20, fontWeight: "900", lineHeight: 26 },
  disabledButton: { opacity: 0.55 },
  primaryButton: { alignItems: "center", backgroundColor: colors.green, borderRadius: radius.control, flexDirection: "row", gap: 8, justifyContent: "center", minHeight: 54, paddingHorizontal: 14 },
  primaryButtonText: { color: "#fff", fontSize: 16, fontWeight: "900" },
  webButton: { alignItems: "center", backgroundColor: colors.surfaceSoft, borderColor: colors.line, borderRadius: radius.control, borderWidth: 1, flexDirection: "row", gap: 8, justifyContent: "center", minHeight: 50, paddingHorizontal: 14 },
  webButtonText: { color: colors.greenDark, fontSize: 15, fontWeight: "900" },
  previewButton: { alignItems: "center", backgroundColor: "#f7f3e9", borderColor: "#e4d8bd", borderRadius: radius.control, borderWidth: 1, flexDirection: "row", gap: 8, justifyContent: "center", minHeight: 50, paddingHorizontal: 14 },
  previewButtonText: { color: colors.greenDark, fontSize: 15, fontWeight: "900" },
  loginButton: { alignItems: "center", minHeight: 36, justifyContent: "center" },
  loginText: { color: colors.blue, fontWeight: "900" },
  noteBand: { alignItems: "center", backgroundColor: "#fff9eb", borderColor: "#ead9b8", borderRadius: radius.card, borderWidth: 1, flexDirection: "row", gap: 10, padding: 13 },
  noteBandText: { color: "#6f532b", flex: 1, fontSize: 13, fontWeight: "800", lineHeight: 20 },
  storyPanel: { backgroundColor: colors.surface, borderColor: colors.line, borderRadius: radius.card, borderWidth: 1, gap: 12, padding: 16 },
  sectionTitle: { color: colors.ink, fontSize: 22, fontWeight: "900", lineHeight: 28 },
  safePanel: { backgroundColor: "#f7f3e9", borderColor: "#e4d8bd", borderRadius: radius.card, borderWidth: 1, gap: 10, padding: 16 },
  safeHeader: { alignItems: "center", flexDirection: "row", gap: 8 },
  safeTitle: { color: colors.greenDark, flex: 1, fontSize: 18, fontWeight: "900", lineHeight: 24 },
  featureRow: { alignItems: "center", flexDirection: "row", gap: 12 },
  iconWrap: { alignItems: "center", backgroundColor: colors.surfaceSoft, borderRadius: 999, height: 44, justifyContent: "center", width: 44 },
  featureText: { flex: 1, gap: 3 },
  featureTitle: { color: colors.ink, fontSize: 16, fontWeight: "900", lineHeight: 22 },
  body: { color: colors.muted, lineHeight: 22 },
  authPanel: { backgroundColor: colors.surface, borderColor: colors.line, borderRadius: radius.card, borderWidth: 1, gap: 12, padding: 16, ...shadow },
  authTitle: { color: colors.ink, fontSize: 22, fontWeight: "900", lineHeight: 28 },
  authLead: { color: colors.muted, lineHeight: 22 },
  input: { backgroundColor: colors.surface, borderColor: colors.line, borderRadius: radius.control, borderWidth: 1, color: colors.ink, fontSize: 16, minHeight: 50, padding: 12 },
  privacyNote: { alignItems: "flex-start", backgroundColor: colors.surfaceSoft, borderColor: colors.line, borderRadius: radius.control, borderWidth: 1, flexDirection: "row", gap: 8, padding: 10 },
  privacyText: { color: colors.greenDark, flex: 1, fontSize: 12, fontWeight: "800", lineHeight: 19 },
  message: { color: colors.greenDark, fontSize: 13, fontWeight: "900", lineHeight: 20 }
});
