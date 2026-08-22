import { StyleSheet, Text, View } from "react-native";
import { colors, radius } from "@/lib/theme";

/**
 * 正式ロゴ「見守り鳥」。docs/BRAND_ASSETS.md と
 * apps/web/public/brand/watch-bird-mark.svg（viewBox 56×56）に合わせている。
 * アイコンとスプラッシュだけ差し替えても、画面の中のこの記号は図形で描いているため
 * 変わらない。Web・アプリ・通知で同じ記号に見えるよう、ここも同じ寸法で描く。
 */
const BIRD = {
  outline: "#33424A",
  hat: "#4A8FA6",
  beak: "#E8A15D",
  face: "#ffffff"
};

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
  // SVGは56×56を基準に描いてある。同じ比率のまま任意の大きさへ伸ばす。
  const u = size / 56;
  // 輪郭線は枠の内側に描かれるので、中の座標はその分だけずらす。
  const stroke = 3 * u;

  return (
    <View
      style={[
        styles.face,
        {
          borderRadius: 28 * u,
          borderWidth: stroke,
          height: size,
          width: size
        }
      ]}
    >
      <View
        style={[
          styles.hat,
          {
            borderTopLeftRadius: 15 * u,
            borderTopRightRadius: 15 * u,
            height: 15 * u,
            left: 10 * u,
            top: -4 * u,
            width: 30 * u
          }
        ]}
      />
      <View style={[styles.eye, { borderRadius: 3 * u, height: 6 * u, left: 11 * u, top: 21 * u, width: 6 * u }]} />
      <View style={[styles.eye, { borderRadius: 3 * u, height: 6 * u, left: 33 * u, top: 21 * u, width: 6 * u }]} />
      <View style={[styles.beak, { borderRadius: 2 * u, height: 8 * u, left: 20.5 * u, top: 28 * u, width: 9 * u }]} />
      <View style={[styles.beak, { borderRadius: 3 * u, height: 6 * u, left: 20.5 * u, top: 30 * u, width: 9 * u }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", flexDirection: "row", gap: 10 },
  wrapCompact: { gap: 8 },
  // overflow:hidden で、帽子が頭の丸みからはみ出さないようにする。
  face: { backgroundColor: BIRD.face, borderColor: BIRD.outline, overflow: "hidden", position: "relative" },
  hat: { backgroundColor: BIRD.hat, position: "absolute" },
  eye: { backgroundColor: BIRD.outline, position: "absolute" },
  beak: { backgroundColor: BIRD.beak, position: "absolute" },
  bubble: { backgroundColor: "#fffaf0", borderColor: "#ead9b8", borderRadius: radius.card, borderWidth: 1, flex: 1, paddingHorizontal: 12, paddingVertical: 10 },
  bubbleText: { color: colors.greenDark, fontSize: 13, fontWeight: "900", lineHeight: 20 }
});
