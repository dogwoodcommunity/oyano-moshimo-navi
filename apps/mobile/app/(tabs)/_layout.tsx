import { Tabs } from "expo-router";

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerStyle: { backgroundColor: "#fbfcf7" }, tabBarActiveTintColor: "#2f6f4e" }}>
      <Tabs.Screen name="dashboard" options={{ title: "Dashboard" }} />
      <Tabs.Screen name="plan" options={{ title: "Plan" }} />
    </Tabs>
  );
}
