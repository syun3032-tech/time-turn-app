"use client";

import { Box, Card, Text } from "@chakra-ui/react";
import { CharacterAvatar, Expression } from "./CharacterAvatar";
import { useState, useEffect, useRef } from "react";

interface CharacterMessageProps {
  message: string;
  expression?: Expression;
  showAvatar?: boolean;
  avatarSize?: "small" | "medium" | "large";
  typing?: boolean; // タイピングアニメーション有効化
  typingSpeed?: number; // 1文字あたりのミリ秒（デフォルト50ms）
}

const AVATAR_SIZES = {
  small: { width: "80px", height: "120px" },
  medium: { width: "150px", height: "225px" },
  large: { width: "200px", height: "300px" },
};

export function CharacterMessage({
  message,
  expression = "open_mouth",
  showAvatar = true,
  avatarSize = "medium",
  typing = false,
  typingSpeed = 50,
}: CharacterMessageProps) {
  const size = AVATAR_SIZES[avatarSize];
  const [displayedText, setDisplayedText] = useState(typing ? "" : message);
  const [isTyping, setIsTyping] = useState(typing);
  const prevMessageRef = useRef(message);

  useEffect(() => {
    // メッセージが変わったらリセット
    if (message !== prevMessageRef.current) {
      prevMessageRef.current = message;
      if (typing) {
        setDisplayedText("");
        setIsTyping(true);
      } else {
        setDisplayedText(message);
      }
    }
  }, [message, typing]);

  useEffect(() => {
    if (!typing || !isTyping) return;

    if (displayedText.length < message.length) {
      const timer = setTimeout(() => {
        setDisplayedText(message.slice(0, displayedText.length + 1));
      }, typingSpeed);
      return () => clearTimeout(timer);
    } else {
      setIsTyping(false);
    }
  }, [displayedText, message, typing, typingSpeed, isTyping]);

  return (
    <Box display="flex" gap={4} alignItems="start" mb={4}>
      {showAvatar && (
        <Box flexShrink={0}>
          <CharacterAvatar
            expression={expression}
            width={size.width}
            height={size.height}
          />
        </Box>
      )}
      <Card.Root flex={1} bg="white" boxShadow="sm">
        <Card.Body>
          <Text fontSize="md" lineHeight="1.8">
            {displayedText}
            {typing && isTyping && (
              <Box as="span" animation="blink 1s infinite" ml={1}>▌</Box>
            )}
          </Text>
        </Card.Body>
      </Card.Root>
    </Box>
  );
}
