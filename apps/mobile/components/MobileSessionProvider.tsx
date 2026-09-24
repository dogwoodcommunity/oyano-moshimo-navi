import { createContext, useContext, useEffect, useState, type PropsWithChildren } from "react";
import { Redirect } from "expo-router";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { observeMobileSession, type MobileSessionState } from "@/lib/session";
import { colors } from "@/lib/theme";

const SessionContext = createContext<MobileSessionState>({ status: "loading", userId: null });

export function MobileSessionProvider({ children }: PropsWithChildren) {
  const [state, setState] = useState<MobileSessionState>({ status: "loading", userId: null });
  useEffect(() => observeMobileSession(setState), []);
  return <SessionContext.Provider value={state}>{children}</SessionContext.Provider>;
}

export const useMobileSession = () => useContext(SessionContext);

export function ProtectedScreen({ children }: PropsWithChildren) {
  const state = useMobileSession();
  if (state.status === "loading") return <View style={styles.loading}>
    <ActivityIndicator color={colors.green} />
    <Text style={styles.text}>ログインを確認しています…</Text>
  </View>;
  if (state.status !== "signed-in") return <Redirect href="/(auth)/welcome" />;
  // Remount private state if the authenticated person changes.
  return <View key={state.userId} style={styles.content}>{children}</View>;
}

const styles = StyleSheet.create({
  content: { flex: 1 },
  loading: { alignItems: "center", backgroundColor: colors.paper, flex: 1, gap: 16, justifyContent: "center" },
  text: { color: colors.ink, fontSize: 16 }
});
