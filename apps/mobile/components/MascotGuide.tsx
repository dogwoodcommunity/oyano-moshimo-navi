import { StyleSheet, Text, View } from "react-native";
import { colors, radius, shadow } from "@/lib/theme";

type MascotGuideProps = {
  message?: string;
  compact?: boolean;
};

export function MascotGuide({ compact = false, message }: MascotGuideProps) {
  return (
    <View style={[styles.wrap, compact ? styles.wrapCompact : null]}>
      <MascotMark size={compact ? 58 : 76} />
      {message ? (
        <View style={styles.bubble}>
          <Text style={styles.bubbleText}>{message}</Text>
        </View>
      ) : null}
    </View>
  );
}

export function MascotMark({ size = 76 }: { size?: number }) {
  const scale = size / 76;

  return (
    <View style={[styles.mark, { height: size, width: size }]}>
      <View
        style={[
          styles.leaf,
          {
            borderBottomLeftRadius: 4 * scale,
            borderTopLeftRadius: 22 * scale,
            borderTopRightRadius: 22 * scale,
            height: 24 * scale,
            right: 7 * scale,
            top: -4 * scale,
            transform: [{ rotate: "28deg" }],
            width: 18 * scale
          }
        ]}
      />
      <View
        style={[
          styles.book,
          {
            borderRadius: 18 * scale,
            height: 58 * scale,
            width: 52 * scale
          }
        ]}
      >
        <View style={[styles.bookStripe, { width: 7 * scale }]} />
        <View style={[styles.faceRow, { gap: 8 * scale, marginTop: 16 * scale }]}>
          <View style={[styles.eye, { height: 5 * scale, width: 5 * scale }]} />
          <View style={[styles.eye, { height: 5 * scale, width: 5 * scale }]} />
        </View>
        <View style={[styles.smile, { height: 8 * scale, marginTop: 5 * scale, width: 18 * scale }]} />
        <View
          style={[
            styles.check,
            {
              borderBottomWidth: 3 * scale,
              borderLeftWidth: 3 * scale,
              height: 10 * scale,
              marginTop: 8 * scale,
              width: 18 * scale
            }
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", flexDirection: "row", gap: 10 },
  wrapCompact: { gap: 8 },
  mark: { alignItems: "center", justifyContent: "center", position: "relative" },
  leaf: { backgroundColor: "#7f9857", borderColor: "rgba(21,59,43,0.2)", borderWidth: 1, position: "absolute", zIndex: 2 },
  book: { alignItems: "center", backgroundColor: colors.green, borderColor: colors.greenDark, borderWidth: 2, overflow: "hidden", ...shadow },
  bookStripe: { backgroundColor: "rgba(255,253,247,0.22)", bottom: 0, left: 7, position: "absolute", top: 0 },
  faceRow: { flexDirection: "row" },
  eye: { backgroundColor: colors.surface, borderRadius: 999 },
  smile: { borderBottomColor: colors.surface, borderBottomWidth: 2, borderRadius: 999 },
  check: { borderColor: colors.surface, transform: [{ rotate: "-45deg" }] },
  bubble: { backgroundColor: "#fffaf0", borderColor: "#ead9b8", borderRadius: radius.card, borderWidth: 1, flex: 1, paddingHorizontal: 12, paddingVertical: 10 },
  bubbleText: { color: colors.greenDark, fontSize: 13, fontWeight: "900", lineHeight: 20 }
});
