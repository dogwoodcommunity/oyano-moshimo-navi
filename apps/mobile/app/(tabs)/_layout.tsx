import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Redirect, Tabs } from "expo-router";
import { useEffect, useState } from "react";
import { isDemoSessionActive } from "@/lib/demoSession";
import { getSupabase } from "@/lib/supabase";
import { colors } from "@/lib/theme";

export default function TabsLayout() {
  const [canEnter, setCanEnter] = useState<boolean | null>(null);

  useEffect(() => {
    let mounted = true;

    async function checkEntry() {
      if (isDemoSessionActive()) {
        if (mounted) setCanEnter(true);
        return;
      }

      const supabase = getSupabase();
      if (!supabase) {
        if (mounted) setCanEnter(true);
        return;
      }

      const { data } = await supabase.auth.getSession();
      if (mounted) setCanEnter(Boolean(data.session));
    }

    void checkEntry();
    return () => {
      mounted = false;
    };
  }, []);

  if (canEnter === null) return null;
  if (!canEnter) return <Redirect href="/(auth)/welcome" />;

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
          title: "プラン",
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
  );
}
