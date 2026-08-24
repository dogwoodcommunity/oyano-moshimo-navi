import type { Metadata } from "next";
import { MonitorStart } from "./MonitorStart";

export const metadata: Metadata = {
  title: "モニターテストのご案内",
  robots: { index: false, follow: false }
};

export default function MonitorPage() {
  return <MonitorStart />;
}
