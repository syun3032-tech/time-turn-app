/**
 * プレーンテキストメモ（**bold**, ## heading等）をHTMLに変換する
 * AI出力や既存メモの互換性のため
 */
export function textToHtml(text: string): string {
  if (!text) return "";

  // 既にHTMLの場合はそのまま返す
  if (text.trim().startsWith("<") && (text.includes("</p>") || text.includes("</h"))) {
    return text;
  }

  const lines = text.split("\n");
  const htmlLines: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();

    // 空行
    if (trimmed === "") {
      htmlLines.push("<p></p>");
      continue;
    }

    // 区切り線
    if (trimmed === "---") {
      htmlLines.push("<hr>");
      continue;
    }

    // 見出し ##
    if (trimmed.startsWith("## ")) {
      const content = inlineBoldToHtml(trimmed.slice(3));
      htmlLines.push(`<h2>${content}</h2>`);
      continue;
    }

    // 日付行 [2026/02/15]
    if (/^\[[\d/]+\]$/.test(trimmed)) {
      htmlLines.push(`<p style="color:#a0aec0;font-size:12px">${trimmed}</p>`);
      continue;
    }

    // 通常テキスト（**太字** をHTMLに変換）
    const content = inlineBoldToHtml(trimmed);
    htmlLines.push(`<p>${content}</p>`);
  }

  return htmlLines.join("");
}

/** **太字** → <strong>太字</strong> に変換 */
function inlineBoldToHtml(text: string): string {
  return text.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
}

/**
 * HTMLからプレーンテキストを抽出する（検索・AI用）
 */
export function htmlToPlainText(html: string): string {
  if (!html) return "";
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/h[1-6]>/gi, "\n")
    .replace(/<hr\s*\/?>/gi, "---\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
