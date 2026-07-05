import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { getSupabase } from "@/lib/supabase";
import { demoPerson } from "@/lib/demoData";

export default function AssetsScreen() {
  const [title, setTitle] = useState("保険証券");
  const [location, setLocation] = useState("実家の茶色い棚");
  const [message, setMessage] = useState("");

  async function save() {
    const client = getSupabase();
    if (client) {
      await client.from("asset_items").insert({
        person_id: demoPerson.id,
        title,
        existence_status: "exists",
        location_note: location
      });
    }
    setMessage("存在と保管場所を保存しました。暗証番号・パスワードは保存対象外です。");
  }

  return (
    <ScrollView contentContainerStyle={styles.screen}>
      <Text style={styles.title}>情報の存在・保管場所</Text>
      <Text style={styles.body}>銀行暗証番号、パスワード、マイナンバー画像は保存しません。</Text>
      <View style={styles.card}>
        <Text style={styles.label}>項目名</Text>
        <TextInput style={styles.input} value={title} onChangeText={setTitle} />
        <Text style={styles.label}>保管場所メモ</Text>
        <TextInput style={styles.input} value={location} onChangeText={setLocation} />
        <Pressable style={styles.button} onPress={save}><Text style={styles.buttonText}>保存</Text></Pressable>
      </View>
      {message ? <Text style={styles.body}>{message}</Text> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: "#fbfcf7", gap: 14, padding: 18 },
  title: { color: "#17211b", fontSize: 30, fontWeight: "900" },
  body: { color: "#344039", lineHeight: 22 },
  card: { backgroundColor: "#fff", borderColor: "#d8e0d8", borderRadius: 8, borderWidth: 1, gap: 10, padding: 16 },
  label: { color: "#17211b", fontWeight: "800" },
  input: { borderColor: "#d8e0d8", borderRadius: 8, borderWidth: 1, minHeight: 46, padding: 12 },
  button: { alignItems: "center", backgroundColor: "#2f6f4e", borderRadius: 8, minHeight: 48, justifyContent: "center" },
  buttonText: { color: "#fff", fontWeight: "800" }
});
