import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "思い出の手帳",
  description: "日々の記録と写真を、家族で振り返る一冊のPDFにまとめます。",
  robots: {
    index: false,
    follow: false
  }
};

export default function MemoryBookLayout({ children }: { children: React.ReactNode }) {
  return children;
}
