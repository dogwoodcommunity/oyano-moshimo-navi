import type { Metadata } from "next";
import { MonitorReportForm } from "./MonitorReportForm";

export const metadata: Metadata = {
  title: "モニターテスト結果報告",
  robots: { index: false, follow: false }
};

export default function MonitorReportPage() {
  return <MonitorReportForm />;
}
