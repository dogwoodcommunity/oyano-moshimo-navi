"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { Guide } from "@/lib/guides";

export function GuideSearch({ guides }: { guides: Guide[] }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("すべて");

  const categories = useMemo(() => {
    const unique = Array.from(new Set(guides.map((guide) => guide.category)));
    return ["すべて", ...unique];
  }, [guides]);

  const filteredGuides = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return guides.filter((guide) => {
      const categoryMatches = category === "すべて" || guide.category === category;
      if (!categoryMatches) return false;
      if (!normalizedQuery) return true;

      const searchText = [
        guide.title,
        guide.category,
        guide.summary,
        guide.concern,
        ...guide.tags,
        ...guide.providers
      ].join(" ").toLowerCase();

      return searchText.includes(normalizedQuery);
    });
  }, [category, guides, query]);

  return (
    <section className="guide-library" aria-label="読む記事を探す">
      <div className="guide-search-panel">
        <div className="guide-search-mascot" aria-hidden="true">
          <img src="/brand/watch-bird-mark.svg" alt="" />
        </div>
        <div className="guide-search-copy">
          <p className="pill">読む記事 {guides.length}本</p>
          <h2>いま困っている言葉で探せます。</h2>
          <p>入院、退院、介護、相続、実家じまい、支払い、薬、写真などで絞れます。</p>
        </div>
        <label className="guide-search-field">
          <span>検索</span>
          <input
            aria-label="記事を検索"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="例: 退院後、保険、鍵、葬儀、写真"
          />
        </label>
      </div>

      <div className="guide-category-strip" aria-label="カテゴリで絞る">
        {categories.map((item) => (
          <button
            aria-pressed={category === item}
            className={category === item ? "active" : ""}
            key={item}
            type="button"
            onClick={() => setCategory(item)}
          >
            {item}
          </button>
        ))}
      </div>

      <div className="guide-result-head">
        <strong>{filteredGuides.length}本表示</strong>
        <span>{category === "すべて" ? "全カテゴリ" : category}{query.trim() ? ` / 「${query.trim()}」` : ""}</span>
      </div>

      {filteredGuides.length > 0 ? (
        <section className="guide-grid">
          {filteredGuides.map((guide) => (
            <Link className="panel guide-card" href={`/guides/${guide.slug}`} key={guide.slug}>
              <div className="guide-card-head">
                <span className="meta-chip">{guide.category}</span>
                <span>{guide.readTime}</span>
              </div>
              <strong>{guide.title}</strong>
              <p>{guide.summary}</p>
              <div className="guide-tag-row">
                {guide.tags.slice(0, 3).map((tag) => <span key={tag}>{tag}</span>)}
              </div>
              <span className="guide-link">読む</span>
            </Link>
          ))}
        </section>
      ) : (
        <div className="panel guide-empty">
          <img src="/brand/watch-bird-mark.svg" alt="" />
          <strong>近い記事が見つかりませんでした。</strong>
          <p>言葉を短くして「保険」「退院」「鍵」などで探してみてください。</p>
        </div>
      )}
    </section>
  );
}
