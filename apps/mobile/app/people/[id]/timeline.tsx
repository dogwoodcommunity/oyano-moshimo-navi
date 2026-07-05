import { ScrollView, StyleSheet, Text, View } from "react-native";
import { demoTimeline } from "@/lib/demoData";

export default function TimelineScreen() {
  return (
    <ScrollView contentContainerStyle={styles.screen}>
      <Text style={styles.title}>タイムライン</Text>
      {demoTimeline.map((item) => (
        <View style={styles.card} key={item.id}>
          <Text style={styles.kicker}>{item.date}</Text>
          <Text style={styles.cardTitle}>{item.title}</Text>
          <Text style={styles.body}>{item.body}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: "#fbfcf7", gap: 14, padding: 18 },
  title: { color: "#17211b", fontSize: 30, fontWeight: "900" },
  card: { backgroundColor: "#fff", borderColor: "#d8e0d8", borderRadius: 8, borderWidth: 1, gap: 8, padding: 16 },
  kicker: { color: "#2f6f4e", fontWeight: "800" },
  cardTitle: { color: "#17211b", fontSize: 20, fontWeight: "900" },
  body: { color: "#344039", lineHeight: 22 }
});
