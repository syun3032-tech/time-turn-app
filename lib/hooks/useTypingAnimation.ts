import { useState, useEffect, useRef } from "react";

interface UseTypingAnimationOptions {
  speed?: number; // 1文字あたりのミリ秒（デフォルト40ms）
  enabled?: boolean; // アニメーション有効化
}

export function useTypingAnimation(
  text: string,
  options: UseTypingAnimationOptions = {}
) {
  const { speed = 40, enabled = true } = options;
  const [displayedText, setDisplayedText] = useState(enabled ? "" : text);
  const [isTyping, setIsTyping] = useState(false);
  const prevTextRef = useRef(text);

  useEffect(() => {
    // テキストが変わったらリセット
    if (text !== prevTextRef.current) {
      prevTextRef.current = text;
      if (enabled) {
        setDisplayedText("");
        setIsTyping(true);
      } else {
        setDisplayedText(text);
        setIsTyping(false);
      }
    }
  }, [text, enabled]);

  useEffect(() => {
    if (!enabled || !isTyping) return;

    if (displayedText.length < text.length) {
      const timer = setTimeout(() => {
        setDisplayedText(text.slice(0, displayedText.length + 1));
      }, speed);
      return () => clearTimeout(timer);
    } else {
      setIsTyping(false);
    }
  }, [displayedText, text, enabled, speed, isTyping]);

  return { displayedText, isTyping };
}
