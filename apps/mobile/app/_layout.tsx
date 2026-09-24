import { useEffect } from "react";
import { Stack } from "expo-router";
import { enableScreens } from "react-native-screens";
import { markNotificationsOpened } from "@/lib/notifications";
import { colors } from "@/lib/theme";
import { MobileSessionProvider } from "@/components/MobileSessionProvider";

enableScreens(false);

export default function RootLayout() {
  useEffect(() => {
    let subscription: { remove: () => void } | null = null;
    let mounted = true;

    const timeout = setTimeout(() => {
      void import("expo-notifications")
        .then((Notifications) => {
          if (!mounted) return;
          subscription = Notifications.addNotificationResponseReceivedListener((response) => {
            void markNotificationsOpened(response.notification.request.content.data ?? {}).catch(() => null);
          });
        })
        .catch(() => {
          return null;
        });
    }, 500);

    return () => {
      mounted = false;
      clearTimeout(timeout);
      subscription?.remove();
    };
  }, []);

  return (
    <MobileSessionProvider>
    <Stack screenOptions={{ headerStyle: { backgroundColor: colors.paper }, headerTintColor: colors.ink }}>
      <Stack.Screen name="(auth)/welcome" options={{ title: "はじめに" }} />
      <Stack.Screen name="auth/complete" options={{ title: "メールの本人確認" }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="consult" options={{ title: "長期相談" }} />
      <Stack.Screen name="crisis/index" options={{ title: "急なとき" }} />
      <Stack.Screen name="crisis/[key]" options={{ title: "急なとき" }} />
      <Stack.Screen name="handoff" options={{ title: "アプリに保存" }} />
      <Stack.Screen name="people" options={{ title: "家族の手帳" }} />
      <Stack.Screen name="invite" options={{ title: "家族招待" }} />
      <Stack.Screen name="notifications" options={{ title: "通知設定" }} />
      <Stack.Screen name="account" options={{ title: "アカウント" }} />
    </Stack>
    </MobileSessionProvider>
  );
}
