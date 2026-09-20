import { Slot } from "expo-router";
import { ProtectedScreen } from "@/components/MobileSessionProvider";

export default function AccountLayout() {
  return <ProtectedScreen><Slot /></ProtectedScreen>;
}
