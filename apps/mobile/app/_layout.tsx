import { Stack } from "expo-router";
import { colors } from "@/lib/theme";

export default function RootLayout() {
  return (
    <Stack screenOptions={{ headerStyle: { backgroundColor: colors.paper }, headerTintColor: colors.ink }}>
      <Stack.Screen name="(auth)/welcome" options={{ title: "ログイン" }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="people/[id]/index" options={{ title: "対象者" }} />
      <Stack.Screen name="people/[id]/tasks" options={{ title: "タスク" }} />
      <Stack.Screen name="people/[id]/status" options={{ title: "状態変更" }} />
      <Stack.Screen name="people/[id]/assets" options={{ title: "情報登録" }} />
      <Stack.Screen name="people/[id]/timeline" options={{ title: "タイムライン" }} />
      <Stack.Screen name="people/[id]/home" options={{ title: "実家カルテ" }} />
      <Stack.Screen name="people/[id]/family" options={{ title: "家族共有" }} />
      <Stack.Screen name="notifications" options={{ title: "通知設定" }} />
      <Stack.Screen name="account/plan" options={{ title: "プラン" }} />
    </Stack>
  );
}
