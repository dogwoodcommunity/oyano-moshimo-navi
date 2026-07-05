import { Tabs } from "expo-router";
import { colors } from "@/lib/theme";

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.paper },
        headerTintColor: colors.ink,
        headerTitleStyle: { fontWeight: "900" },
        tabBarActiveTintColor: colors.green,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.line }
      }}
    >
      <Tabs.Screen name="dashboard" options={{ title: "家族ボード" }} />
      <Tabs.Screen name="plan" options={{ title: "プラン" }} />
    </Tabs>
  );
}
