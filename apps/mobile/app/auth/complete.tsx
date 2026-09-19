import { useEffect, useState } from "react";
import { useURL } from "expo-linking";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { handleAuthRedirectUrl } from "@/lib/auth";
import { colors, radius } from "@/lib/theme";

export default function CompleteMobileAuthScreen() {
  const url = useURL();
  const [message, setMessage] = useState("メールの本人確認をしています…");
  useEffect(() => {
    if (!url) return;
    let active = true;
    void handleAuthRedirectUrl(url).then((result) => {
      if (!active) return;
      setMessage(result.message);
      if (result.handled && result.redirectPath) router.replace(result.redirectPath);
    });
    return () => { active = false; };
  }, [url]);
  return <View style={styles.screen}>
    <Text style={styles.title}>メールの本人確認</Text>
    <Text style={styles.message}>{message}</Text>
    <Pressable style={styles.button} onPress={() => router.canGoBack() ? router.back() : router.replace("/(auth)/welcome")}>
      <Text style={styles.buttonText}>元の画面へ戻る</Text>
    </Pressable>
  </View>;
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.paper, flex: 1, gap: 20, padding: 24 },
  title: { color: colors.ink, fontSize: 26, fontWeight: "900" },
  message: { color: colors.ink, fontSize: 17, lineHeight: 27 },
  button: { backgroundColor: colors.green, padding: 16, borderRadius: radius.control },
  buttonText: { color: "#fff", fontWeight: "800", textAlign: "center" }
});
