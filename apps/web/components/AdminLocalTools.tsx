"use client";

import { useRouter } from "next/navigation";
import { createLocalDemoCase } from "@/lib/store";

export function AdminLocalTools() {
  const router = useRouter();

  function createDemo() {
    const record = createLocalDemoCase();
    router.push(`/admin/cases/${record.id}`);
  }

  return (
    <section className="panel" style={{ marginTop: 18 }}>
      <h2>Local demo</h2>
      <p className="hint">Supabase未設定でも、localStorageに確認用caseを作成できます。</p>
      <div className="actions">
        <button className="secondary" type="button" onClick={createDemo}>
          デモcaseを作成
        </button>
      </div>
    </section>
  );
}

