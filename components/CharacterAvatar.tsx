"use client";

import { Box, Image } from "@chakra-ui/react";

// 表情の種類（将来的に拡張可能）
export type Expression = "normal" | "open_mouth" | "wawa" | "niyari" | "mewo" | "ookiokutigake";

// 表情と画像パスのマッピング
const EXPRESSION_IMAGES: Record<Expression, string> = {
  normal: "/秘書ゆり_ノーマル.png",        // デフォルト
  open_mouth: "/秘書ゆり_お口開けた.png",  // 通常の会話・説明
  wawa: "/わわ_秘書ゆり.png",              // 褒める・応援・驚き
  niyari: "/秘書ゆり_ノーマル.png",        // にやり（画像がない場合はノーマル）
  mewo: "/秘書ゆり_ノーマル.png",          // 目を（画像がない場合はノーマル）
  ookiokutigake: "/秘書ゆり_お口開けた.png", // 大きく口開けた
};

interface CharacterAvatarProps {
  expression?: Expression;
  width?: string;
  height?: string;
  className?: string;
  variant?: "card" | "bare"; // card: カード風（モバイル用）, bare: 枠なし（PC背景用）
}

export function CharacterAvatar({
  expression = "normal",
  width = "280px",
  height = "420px",
  className,
  variant = "card",
}: CharacterAvatarProps) {
  // bareモード: 完全に透明、枠なし
  if (variant === "bare") {
    return (
      <Box
        position="relative"
        w={width}
        h={height}
        className={className}
      >
        <Image
          src={EXPRESSION_IMAGES[expression]}
          alt="秘書ちゃん"
          objectFit="contain"
          w="100%"
          h="100%"
          transition="opacity 0.2s ease-in-out"
        />
      </Box>
    );
  }

  // cardモード: カード風デザイン
  return (
    <Box
      position="relative"
      w={width}
      h={height}
      bg="white"
      borderRadius="20px"
      overflow="hidden"
      boxShadow="0 8px 24px rgba(0,0,0,0.12)"
      border="4px solid"
      borderColor="gray.100"
      className={className}
    >
      <Image
        src={EXPRESSION_IMAGES[expression]}
        alt="秘書ちゃん"
        objectFit="cover"
        w="100%"
        h="100%"
        transition="opacity 0.2s ease-in-out"
      />
    </Box>
  );
}

// 表情を選択するヘルパー関数
export function getExpressionForMessage(message: string): Expression {
  // 褒める・応援・驚き → わわ
  if (
    message.includes("すごい") ||
    message.includes("やった") ||
    message.includes("完璧") ||
    message.includes("素晴らしい") ||
    message.includes("よくできた") ||
    message.includes("頑張った") ||
    message.includes("いいね") ||
    message.includes("頑張って") ||
    message.includes("応援") ||
    message.includes("できるよ") ||
    message.includes("いける") ||
    message.includes("！！") ||
    message.includes("!!") ||
    message.includes("えっ") ||
    message.includes("本当に") ||
    message.includes("まさか")
  ) {
    return "wawa";
  }

  // 通常の会話・説明・質問 → お口開けた
  if (
    message.includes("？") ||
    message.includes("?") ||
    message.includes("ね") ||
    message.includes("よ") ||
    message.includes("だよ") ||
    message.includes("です") ||
    message.includes("ます") ||
    message.length > 10 // 説明っぽい長めのセリフ
  ) {
    return "open_mouth";
  }

  // デフォルトはノーマル
  return "normal";
}

