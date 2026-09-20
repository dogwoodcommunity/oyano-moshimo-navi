import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { ProtectedScreen } from "@/components/MobileSessionProvider";
import { colors } from "@/lib/theme";

export default function TabsLayout() {
  return (
    <ProtectedScreen>
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
      <Tabs.Screen
        name="dashboard"
        options={{
          title: "家族ボード",
          tabBarIcon: ({ color, size }) => <MaterialCommunityIcons color={color} name="account-group-outline" size={size} />
        }}
      />
      <Tabs.Screen
        name="plan"
        options={{
          title: "利用案内",
          tabBarIcon: ({ color, size }) => <MaterialCommunityIcons color={color} name="calendar-check-outline" size={size} />
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "設定",
          tabBarIcon: ({ color, size }) => <MaterialCommunityIcons color={color} name="cog-outline" size={size} />
        }}
      />
    </Tabs>
    </ProtectedScreen>
  );
}
