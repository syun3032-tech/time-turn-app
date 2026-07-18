"use client";

import { useState } from "react";
import { Box, HStack, Textarea, IconButton } from "@chakra-ui/react";
import { FiSend } from "react-icons/fi";

interface ChatInputProps {
  onSend: (text: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function ChatInput({ onSend, disabled, placeholder = "メッセージを入力..." }: ChatInputProps) {
  const [input, setInput] = useState("");

  const handleSend = () => {
    const text = input.trim();
    if (!text || disabled) return;
    setInput("");
    onSend(text);
  };

  return (
    <Box p={3} bg="white" borderTop="1px solid" borderColor="gray.200" flexShrink={0}>
      <HStack gap={2}>
        <Textarea
          placeholder={placeholder}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            // Enter で送信、Shift/Ctrl/Alt/Cmd+Enter で改行
            if (e.key === "Enter" && !e.shiftKey && !e.ctrlKey && !e.altKey && !e.metaKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              handleSend();
            }
          }}
          rows={1}
          resize="none"
          size="md"
          borderRadius="xl"
          bg="gray.100"
          color="gray.800"
          pl={4}
          _placeholder={{ color: "gray.400" }}
          disabled={disabled}
        />
        <IconButton
          aria-label="送信"
          colorScheme="teal"
          borderRadius="full"
          onClick={handleSend}
          disabled={!input.trim() || disabled}
        >
          <FiSend />
        </IconButton>
      </HStack>
    </Box>
  );
}
