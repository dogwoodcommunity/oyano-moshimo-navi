import { useState } from "react";
import { useLocalSearchParams } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { getSupabase } from "@/lib/supabase";
import { colors, radius, shadow } from "@/lib/theme";

export default function AssetsScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const [title, setTitle] = useState("保険証券");
  const [location, setLocation] = useState("実家の茶色い棚");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!title.trim()) {
      setMessage("項目名を入力してください。");
      return;
    }

    setSaving(true);
    const client = getSupabase();
    if (client) {
      const { error } = await client.from("asset_items").insert({
        person_id: params.id,
        title,
        existence_status: "exists",
        location_note: location
      });

      if (error) {
        setSaving(false);
        setMessage(`保存できませんでした: ${error.message}`);
        return;
      }
    }
    setSaving(false);
    setMessage("存在と保管場所を保存しました。暗証番号・パスワードは保存対象外です。");
  }

  return (
    <ScrollView contentContainerStyle={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.kicker}>Registry</Text>
        <Text style={styles.title}>情報の存在・保管場所</Text>
        <Text style={styles.body}>銀行暗証番号、パスワード、マイナンバー画像は保存しません。</Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.label}>項目名</Text>
        <TextInput style={styles.input} value={title} onChangeText={setTitle} />
        <Text style={styles.label}>保管場所メモ</Text>
        <TextInput style={styles.input} value={location} onChangeText={setLocation} />
        <Pressable disabled={saving} style={[styles.button, saving ? styles.buttonDisabled : null]} onPress={save}>
          <Text style={styles.buttonText}>{saving ? "保存中" : "保存"}</Text>
        </Pressable>
      </View>
      {message ? <View style={styles.notice}><Text style={styles.noticeText}>{message}</Text></View> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.paper, gap: 14, padding: 18 },
  header: { gap: 6, paddingTop: 8 },
  kicker: { color: colors.green, fontWeight: "900" },
  title: { color: colors.ink, fontSize: 32, fontWeight: "900", lineHeight: 36 },
  body: { color: colors.muted, lineHeight: 22 },
  card: { backgroundColor: colors.surface, borderColor: colors.line, borderRadius: radius.card, borderWidth: 1, gap: 10, padding: 16, ...shadow },
  label: { color: colors.ink, fontWeight: "900" },
  input: { backgroundColor: "#fff", borderColor: colors.line, borderRadius: radius.control, borderWidth: 1, color: colors.ink, minHeight: 46, padding: 12 },
  button: { alignItems: "center", backgroundColor: colors.green, borderRadius: radius.control, justifyContent: "center", minHeight: 48 },
  buttonDisabled: { opacity: 0.62 },
  buttonText: { color: "#fff", fontWeight: "900" },
  notice: { backgroundColor: colors.surfaceSoft, borderColor: colors.line, borderRadius: radius.card, borderWidth: 1, padding: 12 },
  noticeText: { color: colors.green, fontWeight: "900", lineHeight: 22 }
});
