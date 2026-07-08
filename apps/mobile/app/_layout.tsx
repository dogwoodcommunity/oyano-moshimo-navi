import { useEffect } from "react";
import { Stack } from "expo-router";
import { Linking } from "react-native";
import { enableScreens } from "react-native-screens";
import { handleAuthRedirectUrl } from "@/lib/auth";
import { markNotificationsOpened } from "@/lib/notifications";
import { colors } from "@/lib/theme";

enableScreens(false);

export default function RootLayout() {
  useEffect(() => {
    void Linking.getInitialURL().then((url) => {
      if (url) void handleAuthRedirectUrl(url);
    });

    const subscription = Linking.addEventListener("url", ({ url }) => {
      void handleAuthRedirectUrl(url);
    });

    return () => subscription.remove();
  }, []);

  useEffect(() => {
    let subscription: { remove: () => void } | null = null;
    let mounted = true;

    const timeout = setTimeout(() => {
      void import("expo-notifications").then((Notifications) => {
        if (!mounted) return;
        subscription = Notifications.addNotificationResponseReceivedListener((response) => {
          void markNotificationsOpened(response.notification.request.content.data ?? {});
        });
      });
    }, 500);

    return () => {
      mounted = false;
      clearTimeout(timeout);
      subscription?.remove();
    };
  }, []);

  return (
    <Stack screenOptions={{ headerStyle: { backgroundColor: colors.paper }, headerTintColor: colors.ink }}>
      <Stack.Screen name="(auth)/welcome" options={{ title: "はじめに" }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="handoff" options={{ title: "アプリに保存" }} />
      <Stack.Screen name="people/[id]/index" options={{ title: "対象者" }} />
      <Stack.Screen name="people/[id]/tasks" options={{ title: "タスク" }} />
      <Stack.Screen name="people/[id]/status" options={{ title: "状態変更" }} />
      <Stack.Screen name="people/[id]/assets" options={{ title: "情報登録" }} />
      <Stack.Screen name="people/[id]/timeline" options={{ title: "タイムライン" }} />
      <Stack.Screen name="people/[id]/home" options={{ title: "実家カルテ" }} />
      <Stack.Screen name="people/[id]/family" options={{ title: "家族共有" }} />
      <Stack.Screen name="invite" options={{ title: "家族招待" }} />
      <Stack.Screen name="notifications" options={{ title: "通知設定" }} />
      <Stack.Screen name="account/plan" options={{ title: "プラン" }} />
      <Stack.Screen name="account/delete" options={{ title: "削除依頼" }} />
    </Stack>
  );
}
