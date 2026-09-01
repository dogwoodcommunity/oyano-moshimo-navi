"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { getBrowserSupabase } from "@/lib/browserSupabase";
import { getLocalCase, listDiaryEntries, type CaseRecord, type DiaryEntry } from "@/lib/store";

const MAX_MEMORY_BOOK_PHOTOS = 60;
const NOTEBOOK_CLOUD_PAGE_SIZE = 500;
const NOTEBOOK_CLOUD_RESTORE_LIMIT = 20_000;

function formatBookDate(dateString?: string) {
  if (!dateString) return "日付なし";
  const date = new Date(`${dateString}T00:00:00`);
  if (Number.isNaN(date.getTime())) return dateString;
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short"
  }).format(date);
}

function moodLabel(mood: DiaryEntry["mood"]) {
  if (mood === "urgent") return "急ぎの記録";
  if (mood === "changed") return "変化のあった日";
  return "いつもの日";
}

function entryKind(entry: DiaryEntry) {
  if (isConsultMemo(entry)) {
    return { className: "is-consult", label: "AI相談メモ" };
  }
  return { className: `is-${entry.mood}`, label: moodLabel(entry.mood) };
}

function isConsultMemo(entry: DiaryEntry) {
  return entry.body.trimStart().startsWith("相談メモ:");
}

function personName(caseRecord: CaseRecord) {
  return caseRecord.personProfile?.displayName?.trim() || "この人";
}

export default function MemoryBookPage() {
  const params = useParams<{ caseId: string }>();
  const [loaded, setLoaded] = useState(false);
  const [caseRecord, setCaseRecord] = useState<CaseRecord | null>(null);
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [selectedEntryIds, setSelectedEntryIds] = useState<Set<string>>(new Set());
  const [includePhotos, setIncludePhotos] = useState(true);
  const [photoLoadState, setPhotoLoadState] = useState<"idle" | "loading" | "ready">("idle");
  const [printPreparing, setPrintPreparing] = useState(false);
  const [printError, setPrintError] = useState("");

  useEffect(() => {
    let cancelled = false;
    const nextCase = getLocalCase(params.caseId) ?? null;
    const nextEntries = nextCase
      ? [...listDiaryEntries(nextCase.id)].sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt))
      : [];
    setCaseRecord(nextCase);
    setEntries(nextEntries);
    setSelectedEntryIds(new Set(nextEntries.filter((entry) => !isConsultMemo(entry)).map((entry) => entry.id)));
    setIncludePhotos(nextEntries.reduce((count, entry) => (
      count + entry.attachments.filter((attachment) => attachment.type.startsWith("image/")).length
    ), 0) <= MAX_MEMORY_BOOK_PHOTOS);
    setLoaded(true);
    const needsCloudPhotoUrls = nextEntries.some((entry) => entry.attachments.some((attachment) => (
      attachment.type.startsWith("image/") && Boolean(attachment.storagePath) && !attachment.previewUrl
    )));
    if (!needsCloudPhotoUrls) {
      setPhotoLoadState("ready");
      return () => {
        cancelled = true;
      };
    }

    setPhotoLoadState("loading");
    void (async () => {
      try {
        const client = getBrowserSupabase();
        const sessionData = client ? (await client.auth.getSession()).data : null;
        const accessToken = sessionData?.session?.access_token;
        if (!accessToken) return;
        let diaryOffset = 0;
        let expectedDiaryEntriesTotal: number | null = null;
        const remoteEntriesById = new Map<string, DiaryEntry>();
        while (true) {
          const response = await fetch(
            `/api/notebook/sync?diaryOffset=${diaryOffset}&diaryLimit=${NOTEBOOK_CLOUD_PAGE_SIZE}`,
            {
              cache: "no-store",
              credentials: "same-origin",
              headers: { Authorization: `Bearer ${accessToken}` }
            }
          );
          if (!response.ok) return;
          const result = await response.json() as {
            diaryEntries?: DiaryEntry[];
            diaryEntriesTotal?: number;
            diaryEntriesHasMore?: boolean;
          };
          if (cancelled || !result?.diaryEntries) return;
          if ((result.diaryEntriesTotal ?? 0) > NOTEBOOK_CLOUD_RESTORE_LIMIT) return;
          const diaryEntriesTotal = result.diaryEntriesTotal ?? diaryOffset + result.diaryEntries.length;
          if (expectedDiaryEntriesTotal === null) expectedDiaryEntriesTotal = diaryEntriesTotal;
          else if (diaryEntriesTotal !== expectedDiaryEntriesTotal) return;
          result.diaryEntries.forEach((entry) => remoteEntriesById.set(entry.id, entry));
          if (!result.diaryEntriesHasMore) break;
          if (result.diaryEntries.length === 0) return;
          diaryOffset += result.diaryEntries.length;
        }
        if (remoteEntriesById.size !== (expectedDiaryEntriesTotal ?? 0)) return;
        const remoteById = remoteEntriesById;
        setEntries((current) => current.map((entry) => {
          const remoteEntry = remoteById.get(entry.id);
          if (!remoteEntry) return entry;
          return {
            ...entry,
            attachments: entry.attachments.map((attachment) => {
              const remoteAttachment = remoteEntry.attachments.find((candidate) => (
                candidate.id === attachment.id
                || (attachment.storagePath && candidate.storagePath === attachment.storagePath)
              ));
              return remoteAttachment?.previewUrl
                ? { ...attachment, previewUrl: remoteAttachment.previewUrl }
                : attachment;
            })
          };
        }));
      } catch {
        // 端末内の本文だけでも手帳は作れるため、写真取得失敗では画面全体を止めない。
      } finally {
        if (!cancelled) setPhotoLoadState("ready");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [params.caseId]);

  const selectedEntries = useMemo(
    () => entries.filter((entry) => selectedEntryIds.has(entry.id)),
    [entries, selectedEntryIds]
  );
  const availablePhotoCount = useMemo(
    () => selectedEntries.reduce((count, entry) => count + entry.attachments.filter((attachment) => (
      attachment.type.startsWith("image/") && Boolean(attachment.previewUrl)
    )).length, 0),
    [selectedEntries]
  );
  const unavailablePhotoCount = useMemo(
    () => selectedEntries.reduce((count, entry) => count + entry.attachments.filter((attachment) => (
      attachment.type.startsWith("image/") && !attachment.previewUrl
    )).length, 0),
    [selectedEntries]
  );
  const selectedImageAttachmentCount = useMemo(
    () => selectedEntries.reduce((count, entry) => count + entry.attachments.filter((attachment) => (
      attachment.type.startsWith("image/")
    )).length, 0),
    [selectedEntries]
  );
  const photosOverLimit = selectedImageAttachmentCount > MAX_MEMORY_BOOK_PHOTOS;
  const displayName = caseRecord ? personName(caseRecord) : "この人";
  const firstDate = selectedEntries[0]?.date;
  const lastDate = selectedEntries[selectedEntries.length - 1]?.date;
  const periodLabel = firstDate
    ? firstDate === lastDate
      ? formatBookDate(firstDate)
      : `${formatBookDate(firstDate)}〜${formatBookDate(lastDate)}`
    : "記録を選んでください";

  useEffect(() => {
    if (!caseRecord) return undefined;
    const previousTitle = document.title;
    document.title = `${displayName}の思い出の手帳 | 親のもしもナビ`;
    return () => {
      document.title = previousTitle;
    };
  }, [caseRecord, displayName]);

  useEffect(() => {
    if (photosOverLimit) setIncludePhotos(false);
  }, [photosOverLimit]);

  function toggleEntry(entryId: string) {
    setSelectedEntryIds((current) => {
      const next = new Set(current);
      if (next.has(entryId)) next.delete(entryId);
      else next.add(entryId);
      return next;
    });
    setPrintError("");
  }

  async function openPrintDialog() {
    if (selectedEntries.length === 0) {
      setPrintError("PDFに入れる記録を1件以上選んでください。");
      return;
    }
    setPrintError("");
    if (includePhotos) {
      setPrintPreparing(true);
      const images = Array.from(document.querySelectorAll<HTMLImageElement>(
        ".memory-book-entry.is-included .memory-book-photos img"
      ));
      const imageResults = await Promise.all(images.map(async (image) => {
        if (!image.complete) {
          await new Promise<void>((resolve) => {
            let timer = 0;
            const finish = () => {
              image.removeEventListener("load", finish);
              image.removeEventListener("error", finish);
              window.clearTimeout(timer);
              resolve();
            };
            timer = window.setTimeout(finish, 8000);
            image.addEventListener("load", finish, { once: true });
            image.addEventListener("error", finish, { once: true });
          });
        }
        if (image.naturalWidth === 0) return false;
        try {
          await image.decode();
        } catch {
          // decode非対応でも、表示済みなら印刷できる。
        }
        return image.naturalWidth > 0;
      }));
      setPrintPreparing(false);
      const failedPhotoCount = imageResults.filter((loadedImage) => !loadedImage).length;
      if (failedPhotoCount > 0) {
        setPrintError(`${failedPhotoCount}枚の写真を読み込めませんでした。写真を外して保存するか、通信を確認してもう一度お試しください。`);
        return;
      }
    }
    window.print();
  }

  if (!loaded) {
    return (
      <main className="container memory-book-page">
        <section className="panel"><p>手帳を読み込んでいます。</p></section>
      </main>
    );
  }

  if (!caseRecord) {
    return (
      <main className="container memory-book-page">
        <section className="panel memory-book-actions">
          <p className="pill">思い出の手帳</p>
          <h1 className="page-title">手帳が見つかりませんでした。</h1>
          <p className="lead">手帳へ戻り、対象の方の「必要な時だけ使う」からもう一度開いてください。</p>
          <Link className="button" href="/home">手帳へ戻る</Link>
        </section>
      </main>
    );
  }

  return (
    <main className="container memory-book-page">
      <section className="panel memory-book-actions">
        <p className="pill">無料で残せるPDF</p>
        <h1 className="page-title">これまでの記録を、一冊のPDFに。</h1>
        <p className="lead">
          備えるためだけでなく、あとから家族で振り返るための手帳です。
          この端末に表示できる日々の記録を、{displayName}の「思い出の手帳」として日付順にまとめます。
        </p>

        {entries.length > 0 ? (
          <>
            <div className="memory-book-summary" aria-label="PDFに入れる内容">
              <div><span>選んだ記録</span><strong>{selectedEntries.length}件</strong></div>
              <div><span>記録期間</span><strong>{periodLabel}</strong></div>
              <div><span>表示できる写真</span><strong>{includePhotos ? `${availablePhotoCount}枚` : "入れない"}</strong></div>
            </div>
            <label className="memory-book-photo-choice">
              <input
                type="checkbox"
                checked={includePhotos}
                disabled={photosOverLimit}
                onChange={(event) => setIncludePhotos(event.target.checked)}
              />
              <span>
                <strong>写真もPDFに入れる</strong>
                <small>
                  {photosOverLimit
                    ? `写真は一度に${MAX_MEMORY_BOOK_PHOTOS}枚までです。載せる記録を減らすと選べます。`
                    : "この画面で表示できる写真だけが入ります。"}
                </small>
              </span>
            </label>
            {photosOverLimit ? (
              <p className="memory-book-photo-status is-warning" role="status">
                選んだ記録に写真が{selectedImageAttachmentCount}枚あります。スマホが止まらないよう、写真は外しています。写真も入れる場合は、記録を分けて{MAX_MEMORY_BOOK_PHOTOS}枚以下にしてください。
              </p>
            ) : photoLoadState === "loading" ? (
              <p className="memory-book-photo-status" role="status">クラウド保存した写真を確認しています。少しお待ちください。</p>
            ) : includePhotos && unavailablePhotoCount > 0 ? (
              <p className="memory-book-photo-status is-warning" role="status">
                {unavailablePhotoCount}枚の写真はこの端末で表示できないため、PDFには入りません。手帳に戻り、クラウド保存のメール確認を終えてから、もう一度開いてください。
              </p>
            ) : null}
            <p className="memory-book-select-note">
              毎日の記録は最初からすべて選んでいます。AI相談メモは最初は外しています。載せたい内容だけ、下の「この記録を入れる」で選んでください。
            </p>
            <p className="memory-book-paper-note">紙の本は届きません。PDFデータを端末へ保存する機能です。</p>
            <div className="button-row memory-book-button-row">
              <button className="button" type="button" onClick={openPrintDialog} disabled={photoLoadState === "loading" || printPreparing}>
                {printPreparing ? "写真を準備しています…" : "PDF保存・印刷へ進む"}
              </button>
              <Link className="secondary" href="/home#diary-history">手帳へ戻る</Link>
            </div>
            {printError ? <p className="memory-book-error" role="alert">{printError}</p> : null}
            <details className="memory-book-save-help">
              <summary>スマホでPDFを保存する方法</summary>
              <div>
                <strong>iPhone</strong>
                <ol>
                  <li>印刷プレビューを2本指で広げます。</li>
                  <li>共有ボタンを押します。</li>
                  <li>「ファイルに保存」を選びます。</li>
                </ol>
                <strong>Android</strong>
                <ol>
                  <li>上部のプリンター選択を開きます。</li>
                  <li>「PDF形式で保存」を選びます。</li>
                  <li>保存先を選びます。</li>
                </ol>
                <small>機種により表示名が少し異なる場合があります。</small>
              </div>
            </details>
          </>
        ) : (
          <div className="memory-book-empty">
            <strong>まだ、まとめられる記録がありません。</strong>
            <p>「今日の記録」を1件残すと、ここで一冊の形にできます。</p>
            <Link className="button" href="/home#today-diary">今日の記録を書く</Link>
          </div>
        )}

        <div className="memory-book-safety-note">
          <strong>保存・共有する前にご確認ください</strong>
          <p>PDFには選んだ記録本文、呼び名、記録期間、表示中の写真が入ります。暗証番号や身分証の画像など、共有してはいけない情報がないか確認してください。</p>
          <p>他の家族が入力した記録や、本人・第三者が写った写真を含める場合は、共有してよい内容か確認してください。</p>
          <p>PDFはこの画面から印刷・保存し、自動で家族や第三者へ送信されません。元の手帳の記録も削除されません。</p>
          <p>無料なのはPDFデータの作成です。紙の本の印刷・製本・配送は含みません。</p>
        </div>
      </section>

      {entries.length > 0 ? (
        <section className="memory-book-print" aria-label={`${displayName}の思い出の手帳`}>
          <article className="memory-book-cover">
            <img src="/brand/watch-bird-mark.svg" alt="" aria-hidden="true" />
            <p>親のもしもナビ</p>
            <h2>{displayName}<br />思い出の手帳</h2>
            <strong>{periodLabel}</strong>
            <small>家族で残した日々の記録</small>
          </article>

          <div className="memory-book-intro">
            <p>この一冊は、家族が一日ずつ手帳に残した記録を、古い日から順にまとめたものです。</p>
            <dl>
              <div><dt>記録</dt><dd>{selectedEntries.length}件</dd></div>
              <div><dt>写真</dt><dd>{includePhotos ? `${availablePhotoCount}枚` : "なし"}</dd></div>
              <div><dt>期間</dt><dd>{periodLabel}</dd></div>
            </dl>
          </div>

          <div className="memory-book-entry-list">
            {entries.map((entry) => {
              const included = selectedEntryIds.has(entry.id);
              const kind = entryKind(entry);
              const photos = included && includePhotos
                ? entry.attachments.filter((attachment) => attachment.type.startsWith("image/") && attachment.previewUrl)
                : [];
              return (
                <article className={`memory-book-entry ${included ? "is-included" : "is-excluded"}`} key={entry.id}>
                  <label className="memory-book-entry-choice">
                    <input type="checkbox" checked={included} onChange={() => toggleEntry(entry.id)} />
                    <span>{included ? "この記録を入れる" : "PDFには入れません"}</span>
                  </label>
                  <div className="memory-book-entry-head">
                    <time dateTime={entry.date}>{formatBookDate(entry.date)}</time>
                    <span className={kind.className}>{kind.label}</span>
                  </div>
                  <p>{entry.body}</p>
                  {photos.length > 0 ? (
                    <div className="memory-book-photos">
                      {photos.map((photo, index) => (
                        <figure key={photo.id}>
                          <img src={photo.previewUrl} alt={`${formatBookDate(entry.date)}の記録写真${index + 1}`} />
                          <figcaption>{`記録写真${index + 1}`}</figcaption>
                        </figure>
                      ))}
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>

          <div className="memory-book-bottom-actions">
            <strong>選んだ{selectedEntries.length}件をPDFにまとめます。</strong>
            <p>紙の本は届きません。PDFデータを端末へ保存する機能です。</p>
            <button className="button" type="button" onClick={openPrintDialog} disabled={photoLoadState === "loading" || printPreparing}>
              {printPreparing ? "写真を準備しています…" : "PDF保存・印刷へ進む"}
            </button>
            {printError ? <p className="memory-book-error" role="alert">{printError}</p> : null}
          </div>

          <article className="memory-book-closing">
            <img src="/brand/watch-bird-mark.svg" alt="" aria-hidden="true" />
            <h2>一緒に過ごした日々を、これからも。</h2>
            <p>短い一行も、何も変わらなかった日の記録も、あとから振り返ると家族の大切な時間になります。</p>
            <small>親のもしもナビで作成</small>
          </article>
        </section>
      ) : null}
    </main>
  );
}
