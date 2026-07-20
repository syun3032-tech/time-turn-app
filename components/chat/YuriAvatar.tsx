"use client";

import { Box } from "@chakra-ui/react";
import { useEffect, useRef, useState } from "react";
import type { Expression } from "@/components/CharacterAvatar";

// 整列済みアセット（scripts/align_avatar.py で生成、全て同一構図・背景透過）
const FRAMES = {
  normal: "/yuri/normal.webp",
  mouth_half: "/yuri/mouth_half.webp",
  mouth_wide: "/yuri/mouth_wide.webp",
  eyes_closed: "/yuri/eyes_closed.webp",
  niyari: "/yuri/niyari.webp",
  wawa: "/yuri/wawa.webp",
} as const;

type FrameKey = keyof typeof FRAMES;

// 表情 → 口を閉じたベースフレーム
const EXPRESSION_BASE: Record<Expression, FrameKey> = {
  normal: "normal",
  open_mouth: "normal",
  ookiokutigake: "normal",
  wawa: "wawa",
  niyari: "niyari",
  mewo: "eyes_closed",
};

interface YuriAvatarProps {
  expression: Expression;
  /** 音声再生中 or タイピング表示中 */
  talking: boolean;
  height?: string;
}

/**
 * PNGTuber方式のアニメーションアバター。
 * - 発話中: 口パク（閉じ↔半開き↔大きく開く）+ 小さくバウンス
 * - 待機中: ランダムまばたき + ゆっくり呼吸
 * - 表情変更時: 約0.9秒その表情を見せてから口パクに入る（感情のビート）
 */
export function YuriAvatar({ expression, talking, height = "100%" }: YuriAvatarProps) {
  const base = EXPRESSION_BASE[expression] ?? "normal";
  const [frame, setFrame] = useState<FrameKey>(base);
  const mouthOpenRef = useRef(false);
  const holdUntilRef = useRef(0);

  // 表情が変わったら即反映 + 少しホールド（口パクで潰さない）
  useEffect(() => {
    setFrame(base);
    holdUntilRef.current = Date.now() + (base === "normal" ? 0 : 900);
  }, [base]);

  // 口パクループ
  useEffect(() => {
    if (!talking) {
      mouthOpenRef.current = false;
      setFrame(base);
      return;
    }
    const timer = setInterval(() => {
      if (Date.now() < holdUntilRef.current) return;
      if (mouthOpenRef.current) {
        mouthOpenRef.current = false;
        setFrame(base);
      } else {
        mouthOpenRef.current = true;
        setFrame(Math.random() < 0.3 ? "mouth_wide" : "mouth_half");
      }
    }, 130);
    return () => clearInterval(timer);
  }, [talking, base]);

  // まばたき（待機中・通常表情のみ。eyes_closed/わわ は元々目が閉じている）
  useEffect(() => {
    if (talking || (base !== "normal" && base !== "niyari")) return;
    let blinkTimer: NodeJS.Timeout;
    let restoreTimer: NodeJS.Timeout;
    let cancelled = false;

    const scheduleBlink = () => {
      blinkTimer = setTimeout(() => {
        if (cancelled) return;
        setFrame("eyes_closed");
        restoreTimer = setTimeout(() => {
          if (cancelled) return;
          setFrame(base);
          scheduleBlink();
        }, 140);
      }, 2200 + Math.random() * 3000);
    };
    scheduleBlink();
    return () => {
      cancelled = true;
      clearTimeout(blinkTimer);
      clearTimeout(restoreTimer);
    };
  }, [talking, base]);

  return (
    <Box
      h={height}
      aspectRatio="10 / 13"
      position="relative"
      css={{
        animation: talking
          ? "yuriTalkBounce 0.32s ease-in-out infinite alternate"
          : "yuriBreath 3.6s ease-in-out infinite",
        transformOrigin: "bottom center",
      }}
    >
      {(Object.entries(FRAMES) as [FrameKey, string][]).map(([key, src]) => (
        // 全フレームをマウントしてopacity切替（プリロード済みでチラつかない）
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={key}
          src={src}
          alt={key === frame ? "秘書ゆり" : ""}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "contain",
            opacity: frame === key ? 1 : 0,
            transition: key === "mouth_half" || key === "mouth_wide" ? "none" : "opacity 90ms",
            pointerEvents: "none",
            userSelect: "none",
          }}
          draggable={false}
        />
      ))}
    </Box>
  );
}
