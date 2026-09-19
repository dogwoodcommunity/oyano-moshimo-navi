"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent, MouseEvent } from "react";
import { PREFECTURES } from "@/lib/prefectures";
import {
  PROVIDER_CATEGORIES,
  matchProviderListings,
  normalizeProviderCity,
  validateProviderQuery
} from "@/lib/providerDirectory";
import type { ProviderQuery, PublicProviderListing } from "@/lib/providerDirectory";
import styles from "./ProviderDirectory.module.css";

const EMPTY_QUERY: ProviderQuery = { prefecture: "", city: "", categoryId: "" };
const reviewDateFormatter = new Intl.DateTimeFormat("ja-JP", {
  timeZone: "Asia/Tokyo", year: "numeric", month: "long", day: "numeric"
});

export function ProviderDirectory({ listings }: { listings: PublicProviderListing[] }) {
  const [query, setQuery] = useState<ProviderQuery>(EMPTY_QUERY);
  const [submittedQuery, setSubmittedQuery] = useState<ProviderQuery | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const errorRef = useRef<HTMLParagraphElement>(null);
  const resultsRef = useRef<HTMLHeadingElement>(null);
  const matches = useMemo(
    () => submittedQuery ? matchProviderListings(listings, submittedQuery, now) : null,
    [listings, submittedQuery, now]
  );
  const selectedCategory = PROVIDER_CATEGORIES.find((category) => category.id === submittedQuery?.categoryId);

  useEffect(() => {
    const refresh = () => setNow(Date.now());
    const onVisibility = () => { if (document.visibilityState === "visible") refresh(); };
    const interval = window.setInterval(refresh, 60_000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  useEffect(() => {
    const nextExpiry = listings.reduce((earliest, listing) => {
      const expiry = Date.parse(listing.publishUntil);
      return Number.isFinite(expiry) && expiry > now ? Math.min(earliest, expiry) : earliest;
    }, Infinity);
    if (!Number.isFinite(nextExpiry)) return;
    const delay = Math.min(Math.max(0, nextExpiry - Date.now()), 2_147_483_647);
    const timeout = window.setTimeout(() => setNow(Date.now()), delay);
    return () => window.clearTimeout(timeout);
  }, [listings, now]);

  useEffect(() => {
    if (!submittedQuery) return;
    resultsRef.current?.focus({ preventScroll: true });
    resultsRef.current?.scrollIntoView({ block: "start" });
  }, [submittedQuery]);

  function updateQuery(key: keyof ProviderQuery, value: string) {
    setQuery((current) => ({ ...current, [key]: value }));
    setSubmittedQuery(null);
    setError(null);
    setNotice("");
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validationError = validateProviderQuery(query);
    setError(validationError);
    setNotice("");
    if (validationError) {
      setSubmittedQuery(null);
      window.requestAnimationFrame(() => {
        errorRef.current?.focus({ preventScroll: true });
        errorRef.current?.scrollIntoView({ block: "start" });
      });
      return;
    }
    setNow(Date.now());
    setSubmittedQuery({ ...query, city: normalizeProviderCity(query.city) });
  }

  function checkBeforeOpening(event: MouseEvent<HTMLAnchorElement>, listing: PublicProviderListing) {
    const currentTime = Date.now();
    const current = submittedQuery ? matchProviderListings([listing], submittedQuery, currentTime) : null;
    if (current && (current.sponsored.length || current.general.length)) return;
    event.preventDefault();
    setNow(currentTime);
    setNotice("掲載期間が終了したため、この事業者のリンクは開きませんでした。現在の掲載情報に更新しました。");
    window.requestAnimationFrame(() => resultsRef.current?.focus({ preventScroll: true }));
  }

  function renderCard(listing: PublicProviderListing) {
    const areaLabel = `${submittedQuery?.prefecture} ${submittedQuery?.city}`;
    const sponsored = listing.placement === "sponsored";
    return (
      <li key={listing.id} className={styles.card}>
        {sponsored && <span className={styles.adLabel}>広告</span>}
        <h4>{listing.name}</h4>
        <p>{listing.description}</p>
        <dl className={styles.details}>
          <div><dt>掲載分野</dt><dd>{PROVIDER_CATEGORIES.filter((category) => listing.categoryIds.includes(category.id)).map((category) => category.label).join("・")}</dd></div>
          <div><dt>この地域への対応</dt><dd>{areaLabel}</dd></div>
          <div><dt>掲載情報の最終確認</dt><dd><time dateTime={listing.reviewedAt}>{reviewDateFormatter.format(new Date(listing.reviewedAt))}</time></dd></div>
        </dl>
        <p className={styles.cardNote}>掲載情報の確認日は、サービスの品質や現在の受付状況を保証するものではありません。</p>
        <a
          className={styles.externalLink}
          href={listing.website}
          target="_blank"
          rel={sponsored ? "noopener noreferrer sponsored" : "noopener noreferrer"}
          referrerPolicy="no-referrer"
          onClick={(event) => checkBeforeOpening(event, listing)}
          onAuxClick={(event) => checkBeforeOpening(event, listing)}
        >公式サイトを開く（外部）</a>
      </li>
    );
  }

  return (
    <div className={styles.directory}>
      <form className={styles.form} onSubmit={submit} noValidate aria-labelledby="provider-form-title">
        <h2 id="provider-form-title">探したい地域と分野を選ぶ</h2>
        <p className={styles.intro}>3つの項目を入力して、対応地域と分野が一致する掲載事業者を確認できます。</p>
        <div className={styles.fields}>
          <div className={styles.field}>
            <label htmlFor="provider-prefecture">都道府県 <span>必須</span></label>
            <select
              id="provider-prefecture"
              value={query.prefecture}
              onChange={(event) => updateQuery("prefecture", event.target.value)}
              required
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? "provider-error" : undefined}
            >
              <option value="">選択してください</option>
              {PREFECTURES.map((prefecture) => <option key={prefecture} value={prefecture}>{prefecture}</option>)}
            </select>
          </div>
          <div className={styles.field}>
            <label htmlFor="provider-city">市区町村 <span>必須</span></label>
            <input
              id="provider-city"
              value={query.city}
              onChange={(event) => updateQuery("city", event.target.value)}
              placeholder="神戸市"
              autoComplete="off"
              required
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? "provider-city-help provider-error" : "provider-city-help"}
            />
            <p id="provider-city-help" className={styles.fieldHelp}>番地・住所の詳細は入力しないでください。</p>
          </div>
          <div className={styles.field}>
            <label htmlFor="provider-category">相談したい分野 <span>必須</span></label>
            <select
              id="provider-category"
              value={query.categoryId}
              onChange={(event) => updateQuery("categoryId", event.target.value)}
              required
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? "provider-error" : undefined}
            >
              <option value="">選択してください</option>
              {PROVIDER_CATEGORIES.map((category) => <option key={category.id} value={category.id}>{category.label}</option>)}
            </select>
          </div>
        </div>
        {error && <p id="provider-error" ref={errorRef} className={styles.error} role="alert" tabIndex={-1}>{error}</p>}
        <button type="submit" className={styles.submit}>この条件で相談先を見る</button>
        <p className={styles.privacy}>入力した地域・分野は、この画面内の絞り込みだけに使い、送信・保存しません。事業者には手帳や相談内容を渡しません。外部サイトを開くと、そのサイトの規約・プライバシー方針が適用されます。</p>
      </form>

      {submittedQuery && matches && (
        <section className={styles.results} aria-labelledby="provider-results-title">
          <h2 id="provider-results-title" ref={resultsRef} className={styles.resultsTitle} tabIndex={-1}>この条件の相談先</h2>
          <p className={styles.criteria}>{submittedQuery.prefecture} {submittedQuery.city} ／ {selectedCategory?.label}</p>
          {notice && <p className={styles.notice} role="status">{notice}</p>}
          {selectedCategory && <p className={styles.checks}><strong>相談前に確認すること</strong><br />{selectedCategory.checks}</p>}
          <section className={styles.group} aria-labelledby="provider-sponsored-title">
            <h3 id="provider-sponsored-title">広告｜地域の協賛事業者</h3>
            <p>スポンサー契約に基づく優先掲載です。AIによる最適・最寄りの判定や品質保証ではありません。</p>
            {matches.sponsored.length
              ? <ul className={styles.cards}>{matches.sponsored.map(renderCard)}</ul>
              : <p className={styles.empty}>この地域・分野で、現在掲載中の協賛事業者はありません。</p>}
          </section>
          <section className={styles.group} aria-labelledby="provider-general-title">
            <h3 id="provider-general-title">広告以外の掲載事業者</h3>
            <p>スポンサー契約による優先掲載とは別の一覧です。掲載順は、おすすめ順や品質の順位を示すものではありません。</p>
            {matches.general.length
              ? <ul className={styles.cards}>{matches.general.map(renderCard)}</ul>
              : <p className={styles.empty}>この地域・分野で、現在掲載中の広告以外の事業者はありません。</p>}
          </section>
        </section>
      )}
    </div>
  );
}
