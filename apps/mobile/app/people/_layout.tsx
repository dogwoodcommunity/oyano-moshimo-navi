import { Slot } from "expo-router";
import { ProtectedScreen } from "@/components/MobileSessionProvider";

export default function PeopleLayout() {
  return <ProtectedScreen><Slot /></ProtectedScreen>;
}
