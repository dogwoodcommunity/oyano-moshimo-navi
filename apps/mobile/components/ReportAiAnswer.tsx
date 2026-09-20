import { useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { AI_REPORT_REASONS, reportAiAnswer, type AiReportReason } from "@/lib/consultReport";
import { colors, radius } from "@/lib/theme";

export function ReportAiAnswer({ turnId }: { turnId: string }) {
  return <ReportForm key={turnId} turnId={turnId} />;
}

function ReportForm({ turnId }: { turnId: string }) {
  const [expanded, setExpanded] = useState(false);
  const [reason, setReason] = useState<AiReportReason | null>(null);
  const [consent, setConsent] = useState(false);
  const [sending, setSending] = useState(false);
  const [received, setReceived] = useState(false);
  const [message, setMessage] = useState("");
  const inFlight = useRef(false);

  async function submit() {
    if (!reason || !consent || inFlight.current || received) return;
    inFlight.current = true;
    setSending(true);
    setMessage("");
    try {
      const result = await reportAiAnswer(turnId, reason);
      if (result.ok) {
        setReceived(true);
        setMessage(result.alreadyReported ? "この回答は報告済みです。" : "報告を受け付けました。ご協力ありがとうございます。");
      } else {
        setMessage(result.message);
      }
    } catch {
      setMessage("報告の受付を確認できませんでした。もう一度お試しください。");
    } finally {
      inFlight.current = false;
      setSending(false);
    }
  }

  if (received) return <Text accessibilityLiveRegion="polite" style={styles.notice}>{message}</Text>;
  return (
    <View style={styles.container}>
      <Pressable accessibilityRole="button" accessibilityState={{ expanded, disabled: sending }}
        disabled={sending} onPress={() => setExpanded((value) => !value)} style={styles.control}>
        <Text style={styles.link}>{expanded ? "報告を閉じる" : "このAI回答の問題を報告"}</Text>
      </Pressable>
      {expanded ? <View style={styles.form}>
        <Text style={styles.body}>問題の種類と回答の識別番号を運営に送ります。調査担当者が、保存済みの相談文とAI回答を確認することがあります。相談の安全性改善に使います。</Text>
        <Text style={styles.body}>問題に近いものを1つ選んでください。</Text>
        {AI_REPORT_REASONS.map((item) => <Pressable key={item.value} accessibilityRole="radio"
          accessibilityState={{ checked: reason === item.value, disabled: sending }}
          disabled={sending} onPress={() => setReason(item.value)}
          style={[styles.option, reason === item.value && styles.selected]}>
          <Text style={styles.body}>{reason === item.value ? "● " : "○ "}{item.label}</Text>
        </Pressable>)}
        <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: consent, disabled: sending }}
          disabled={sending} onPress={() => setConsent((value) => !value)} style={styles.option}>
          <Text style={styles.body}>{consent ? "☑ " : "□ "}説明を確認し、調査のための閲覧に同意する</Text>
        </Pressable>
        {message ? <Text accessibilityLiveRegion="polite" style={styles.error}>{message}</Text> : null}
        <Pressable accessibilityRole="button" accessibilityState={{ disabled: !reason || !consent || sending }}
          disabled={!reason || !consent || sending} onPress={() => void submit()}
          style={[styles.submit, (!reason || !consent || sending) && styles.disabled]}>
          <Text style={styles.submitText}>{sending ? "受付を確認しています…" : "同意して報告する"}</Text>
        </Pressable>
      </View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginTop: 12, borderTopWidth: 1, borderTopColor: colors.line },
  control: { minHeight: 48, justifyContent: "center", paddingVertical: 10 },
  link: { fontSize: 14, lineHeight: 22, color: colors.green, textDecorationLine: "underline" },
  form: { gap: 10, paddingBottom: 8 },
  body: { fontSize: 14, lineHeight: 22, color: colors.ink },
  option: { minHeight: 48, padding: 12, justifyContent: "center", borderWidth: 1, borderColor: colors.line, borderRadius: radius.control },
  selected: { borderColor: colors.green, backgroundColor: colors.surfaceSoft },
  submit: { minHeight: 48, padding: 12, alignItems: "center", justifyContent: "center", borderRadius: radius.control, backgroundColor: colors.green },
  submitText: { color: colors.surface, fontSize: 15, fontWeight: "700" },
  disabled: { opacity: 0.5 },
  notice: { fontSize: 14, lineHeight: 22, color: colors.green, marginTop: 12 },
  error: { fontSize: 14, lineHeight: 22, color: colors.rose }
});
