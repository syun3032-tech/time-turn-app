"use client";

/**
 * Web Speech API（speechSynthesis）でゆりの声を再生する。
 * 無料・端末内蔵。iOSはKyoko等の日本語音声が使われる。
 *
 * iOSの既知の癖:
 * - 初回はユーザー操作起点で speak しないと無音になる → unlockSpeech() をトグルON時に呼ぶ
 * - マナーモード（消音スイッチ）では鳴らない
 * - getVoices() が空を返すことがある → lang 指定だけでもOK（端末デフォルトの日本語音声が選ばれる）
 */

let cachedVoice: SpeechSynthesisVoice | null = null;
let unlocked = false;

export function isSpeechSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

function pickJapaneseVoice(): SpeechSynthesisVoice | null {
  if (cachedVoice) return cachedVoice;
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return null;
  // 優先順: 高品質そうな名前 → ja-JP → ja
  const preferred = ["Kyoko", "O-Ren", "Google 日本語", "Hattori"];
  cachedVoice =
    voices.find(v => preferred.some(p => v.name.includes(p))) ??
    voices.find(v => v.lang === "ja-JP") ??
    voices.find(v => v.lang.startsWith("ja")) ??
    null;
  return cachedVoice;
}

/** ユーザー操作（トグルON等）の中で呼び、iOSの発話制限を解除する */
export function unlockSpeech(): void {
  if (!isSpeechSupported() || unlocked) return;
  const u = new SpeechSynthesisUtterance("");
  u.volume = 0;
  window.speechSynthesis.speak(u);
  unlocked = true;
  // voices の遅延ロード対策
  window.speechSynthesis.onvoiceschanged = () => {
    cachedVoice = null;
    pickJapaneseVoice();
  };
  pickJapaneseVoice();
}

/** 読み上げ用にテキストを整形（記号・マークダウン・URLを除去） */
export function cleanForSpeech(text: string): string {
  return text
    .replace(/https?:\/\/\S+/g, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/[#*`_~\[\]|]/g, "")
    .replace(/^[-・]\s*/gm, "")
    .replace(/\n{2,}/g, "。")
    .replace(/\n/g, "、")
    .trim();
}

export function speak(
  text: string,
  handlers?: { onStart?: () => void; onEnd?: () => void }
): void {
  if (!isSpeechSupported()) {
    handlers?.onEnd?.();
    return;
  }
  const synth = window.speechSynthesis;
  synth.cancel(); // 前の発話を止める

  const cleaned = cleanForSpeech(text);
  if (!cleaned) {
    handlers?.onEnd?.();
    return;
  }

  const utter = new SpeechSynthesisUtterance(cleaned);
  utter.lang = "ja-JP";
  const voice = pickJapaneseVoice();
  if (voice) utter.voice = voice;
  utter.rate = 1.05;
  utter.pitch = 1.1;

  let ended = false;
  const finish = () => {
    if (ended) return;
    ended = true;
    handlers?.onEnd?.();
  };
  utter.onstart = () => handlers?.onStart?.();
  utter.onend = finish;
  utter.onerror = finish;
  // Safariでonendが来ないことがある保険（読了予想時間+3秒）
  setTimeout(finish, Math.min(60000, cleaned.length * 180 + 3000));

  // Safariは cancel() 直後の speak() を無視することがあるため少し待つ
  setTimeout(() => synth.speak(utter), 60);
}

export function stopSpeaking(): void {
  if (isSpeechSupported()) {
    window.speechSynthesis.cancel();
  }
}
