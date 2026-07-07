import { useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { ImageBackground, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { demoResult } from "@/lib/demoData";
import { sendMagicLink } from "@/lib/auth";
import { consumeWebHandoff } from "@/lib/handoff";
import { colors, radius, shadow } from "@/lib/theme";

type AuthMode = "signup" | "login";

export default function WelcomeScreen() {
  const params = useLocalSearchParams<{ caseId?: string; token?: string }>();
  const [authMode, setAuthMode] = useState<AuthMode | null>(null);
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const hasHandoff = Boolean(params.caseId && params.token && params.caseId !== "demo" && params.token !== "demo");
  const authTitle = authMode === "login" ? "メールでログイン" : "メールで会員登録";

  async function continueToApp() {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setMessage("メールアドレスを入力してください。");
      return;
    }

    if (email.trim()) {
      const result = await sendMagicLink(trimmedEmail);
      setMessage(result.message);
      if (result.sent) return;
    }

    const handoff = await consumeWebHandoff(params.caseId, params.token);
    if (handoff) {
      setMessage(`Web診断を引き継ぎました。タスク ${handoff.tasksCreated}件`);
    }
    router.replace("/(tabs)/dashboard");
  }

  async function continueDemo() {
    setMessage(`見本で開きます。確認用タスク ${demoResult.tasks.length}件を表示します。`);
    router.replace("/(tabs)/dashboard");
  }

  function openAuth(mode: AuthMode) {
    setAuthMode(mode);
    setMessage("");
  }

  return (
    <ScrollView contentContainerStyle={styles.screen} style={styles.scroll} keyboardShouldPersistTaps="handled">
      <ImageBackground
        imageStyle={styles.heroImage}
        resizeMode="cover"
        source={require("../../assets/onboarding-family-home.png")}
        style={styles.hero}
      >
        <View style={styles.heroOverlay}>
          <Text style={styles.kicker}>{hasHandoff ? "Webの整理結果を保存できます" : "親のもしもナビ"}</Text>
          <Text style={styles.title}>もしもの前に、家族で迷わない準備を。</Text>
          <Text style={styles.lead}>
            入院、認知症、相続、実家整理。必要なことを家族で共有し、期限と担当を忘れないためのアプリです。
          </Text>
        </View>
      </ImageBackground>

      <View style={styles.introCard}>
        <Text style={styles.sectionTitle}>このアプリでできること</Text>
        <View style={styles.featureRow}>
          <Text style={styles.featureNumber}>1</Text>
          <View style={styles.featureText}>
            <Text style={styles.featureTitle}>期限を忘れない</Text>
            <Text style={styles.body}>死亡届、年金、相続税など、期限のある手続きを必要な時だけ知らせます。</Text>
          </View>
        </View>
        <View style={styles.featureRow}>
          <Text style={styles.featureNumber}>2</Text>
          <View style={styles.featureText}>
            <Text style={styles.featureTitle}>家族で担当を分ける</Text>
            <Text style={styles.body}>誰が何をするか、担当未定のまま残っていることを見える化します。</Text>
          </View>
        </View>
        <View style={styles.featureRow}>
          <Text style={styles.featureNumber}>3</Text>
          <View style={styles.featureText}>
            <Text style={styles.featureTitle}>写真とメモを保管する</Text>
            <Text style={styles.body}>書類の置き場所や実家の状況を、必要な時に家族で確認できます。</Text>
          </View>
        </View>
      </View>

      <View style={styles.ctaCard}>
        <Text style={styles.ctaTitle}>{hasHandoff ? "整理結果を家族ボードに保存する" : "詳しく使いたい方は会員登録へ"}</Text>
        <Text style={styles.ctaBody}>内容を確認してからで大丈夫です。登録すると、家族ボード、期限通知、写真管理が使えるようになります。</Text>
        <Pressable onPress={() => openAuth("signup")} style={styles.button}>
          <Text style={styles.buttonText}>{hasHandoff ? "新規会員登録して保存する" : "新規会員登録はこちら"}</Text>
        </Pressable>
        <Pressable onPress={() => openAuth("login")} style={styles.subtleButton}>
          <Text style={styles.subtleButtonText}>登録済みの方はログイン</Text>
        </Pressable>
      </View>

      {authMode ? (
        <View style={styles.panel}>
          <Text style={styles.label}>{authTitle}</Text>
          <TextInput
            autoCapitalize="none"
            inputMode="email"
            onChangeText={setEmail}
            placeholder="mail@example.com"
            style={styles.input}
            value={email}
          />
          <Text style={styles.hint}>パスワードは使わず、メールに届くリンクで本人確認します。</Text>
          <Text style={styles.privacyNote}>
            親の入院、認知症、死亡などの情報は慎重に扱う必要があります。家族の支援に必要な範囲だけ保存してください。
          </Text>
          <Pressable onPress={continueToApp} style={styles.button}>
            <Text style={styles.buttonText}>{hasHandoff ? "確認メールを送って引き継ぐ" : "確認メールを送る"}</Text>
          </Pressable>
          <Text style={styles.hint}>暗証番号、パスワード、マイナンバー画像は保存しないでください。</Text>
          {message ? <Text style={styles.message}>{message}</Text> : null}
        </View>
      ) : null}

      <View style={styles.demoCard}>
        <Text style={styles.demoTitle}>まず見本を見る</Text>
        <Text style={styles.hint}>登録前に、家族ボードの見え方だけ確認できます。入力内容は保存されません。</Text>
        <Pressable onPress={continueDemo}>
          <Text style={styles.link}>見本で開く</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { backgroundColor: colors.paper, flex: 1 },
  screen: { gap: 14, padding: 18, paddingBottom: 36, paddingTop: 48 },
  hero: { backgroundColor: colors.surfaceSoft, borderRadius: radius.card, minHeight: 330, overflow: "hidden" },
  heroImage: { borderRadius: radius.card },
  heroOverlay: { backgroundColor: "rgba(18, 32, 28, 0.46)", flex: 1, justifyContent: "flex-end", gap: 12, padding: 20 },
  kicker: { color: "#f3f7ed", fontWeight: "900" },
  title: { color: "#fff", fontSize: 32, fontWeight: "900", lineHeight: 38 },
  lead: { color: "rgba(255,255,255,0.88)", fontSize: 16, lineHeight: 25 },
  introCard: { backgroundColor: colors.surface, borderColor: colors.line, borderRadius: radius.card, borderWidth: 1, gap: 14, padding: 16, ...shadow },
  sectionTitle: { color: colors.ink, fontSize: 22, fontWeight: "900" },
  featureRow: { alignItems: "flex-start", flexDirection: "row", gap: 12 },
  featureNumber: { backgroundColor: colors.surfaceSoft, borderRadius: 999, color: colors.green, fontWeight: "900", height: 30, lineHeight: 30, textAlign: "center", width: 30 },
  featureText: { flex: 1, gap: 4 },
  featureTitle: { color: colors.ink, fontSize: 16, fontWeight: "900", lineHeight: 22 },
  body: { color: colors.muted, lineHeight: 22 },
  ctaCard: { backgroundColor: colors.greenDark, borderColor: colors.greenDark, borderRadius: radius.card, borderWidth: 1, gap: 12, padding: 16, ...shadow },
  ctaBody: { color: "rgba(255,255,255,0.82)", lineHeight: 22 },
  ctaTitle: { color: "#fff", fontSize: 22, fontWeight: "900", lineHeight: 28 },
  panel: { backgroundColor: colors.surface, borderColor: colors.line, borderRadius: radius.card, borderWidth: 1, gap: 12, padding: 16, ...shadow },
  label: { color: colors.ink, fontWeight: "900" },
  input: { backgroundColor: colors.surface, borderColor: colors.line, borderRadius: radius.control, borderWidth: 1, color: colors.ink, minHeight: 46, padding: 12 },
  privacyNote: { backgroundColor: colors.surfaceSoft, borderColor: colors.line, borderRadius: radius.control, borderWidth: 1, color: colors.greenDark, fontSize: 12, fontWeight: "800", lineHeight: 19, padding: 10 },
  button: { alignItems: "center", backgroundColor: colors.green, borderRadius: radius.control, minHeight: 48, justifyContent: "center" },
  buttonText: { color: "#fff", fontWeight: "900" },
  subtleButton: { alignItems: "center", backgroundColor: "rgba(255,255,255,0.12)", borderColor: "rgba(255,255,255,0.24)", borderRadius: radius.control, borderWidth: 1, minHeight: 46, justifyContent: "center" },
  subtleButtonText: { color: "#fff", fontWeight: "900" },
  demoCard: { backgroundColor: colors.surface, borderColor: colors.line, borderRadius: radius.card, borderWidth: 1, gap: 8, padding: 14 },
  demoTitle: { color: colors.ink, fontSize: 18, fontWeight: "900" },
  hint: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  message: { color: colors.greenDark, fontSize: 12, fontWeight: "800", lineHeight: 18 },
  link: { color: colors.blue, fontWeight: "900" }
});
