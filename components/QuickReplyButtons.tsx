"use client";

import { useState } from "react";
import { Box, Button, HStack, Text } from "@chakra-ui/react";
import type { QuickReplyType } from "@/lib/parse-quick-replies";

interface QuickReplyButtonsProps {
  type: QuickReplyType;
  options: string[];
  onSelect: (option: string) => void;
  onMultiSubmit: (selectedOptions: string[]) => void;
  onRankSubmit: (orderedOptions: string[]) => void;
}

export function QuickReplyButtons({
  type,
  options,
  onSelect,
  onMultiSubmit,
  onRankSubmit,
}: QuickReplyButtonsProps) {
  const [multiSelected, setMultiSelected] = useState<Set<string>>(new Set());
  const [rankOrder, setRankOrder] = useState<string[]>([]);

  // 単一選択
  if (type === "select") {
    return (
      <Box w="100%" px={2}>
        <HStack gap={2} flexWrap="wrap" justify="center">
          {options.map((opt) => (
            <Button
              key={opt}
              size="sm"
              minH="40px"
              px={4}
              borderRadius="full"
              variant="outline"
              colorScheme="teal"
              borderWidth="2px"
              fontWeight="bold"
              onClick={() => onSelect(opt)}
              _hover={{ bg: "teal.500", color: "white" }}
            >
              {opt}
            </Button>
          ))}
        </HStack>
      </Box>
    );
  }

  // 複数選択
  if (type === "multi") {
    const toggleOption = (opt: string) => {
      setMultiSelected((prev) => {
        const next = new Set(prev);
        if (next.has(opt)) {
          next.delete(opt);
        } else {
          next.add(opt);
        }
        return next;
      });
    };

    return (
      <Box w="100%" px={2}>
        <HStack gap={2} flexWrap="wrap" justify="center" mb={2}>
          {options.map((opt) => {
            const isSelected = multiSelected.has(opt);
            return (
              <Button
                key={opt}
                size="sm"
                minH="40px"
                px={4}
                borderRadius="full"
                variant={isSelected ? "solid" : "outline"}
                colorScheme="teal"
                borderWidth="2px"
                fontWeight="bold"
                onClick={() => toggleOption(opt)}
              >
                {opt}
              </Button>
            );
          })}
        </HStack>
        {multiSelected.size > 0 && (
          <HStack justify="center">
            <Button
              size="sm"
              minH="36px"
              colorScheme="teal"
              borderRadius="full"
              px={6}
              onClick={() => onMultiSubmit(Array.from(multiSelected))}
            >
              送信（{multiSelected.size}件）
            </Button>
          </HStack>
        )}
      </Box>
    );
  }

  // 優先順位
  if (type === "rank") {
    const toggleRank = (opt: string) => {
      setRankOrder((prev) => {
        const idx = prev.indexOf(opt);
        if (idx >= 0) {
          return prev.filter((o) => o !== opt);
        }
        return [...prev, opt];
      });
    };

    const resetRank = () => setRankOrder([]);

    const getRankNumber = (opt: string): number => {
      return rankOrder.indexOf(opt) + 1;
    };

    const rankLabels = ["①", "②", "③", "④", "⑤", "⑥"];

    return (
      <Box w="100%" px={2}>
        <HStack gap={2} flexWrap="wrap" justify="center" mb={2}>
          {options.map((opt) => {
            const rank = getRankNumber(opt);
            const isRanked = rank > 0;
            return (
              <Button
                key={opt}
                size="sm"
                minH="40px"
                px={4}
                borderRadius="full"
                variant={isRanked ? "solid" : "outline"}
                colorScheme="teal"
                borderWidth="2px"
                fontWeight="bold"
                onClick={() => toggleRank(opt)}
              >
                {isRanked && (
                  <Text as="span" mr={1}>
                    {rankLabels[rank - 1]}
                  </Text>
                )}
                {opt}
              </Button>
            );
          })}
        </HStack>
        {rankOrder.length > 0 && (
          <HStack justify="center" gap={2}>
            <Button
              size="sm"
              minH="36px"
              variant="outline"
              colorScheme="gray"
              borderRadius="full"
              px={4}
              onClick={resetRank}
            >
              やり直し
            </Button>
            <Button
              size="sm"
              minH="36px"
              colorScheme="teal"
              borderRadius="full"
              px={6}
              onClick={() => onRankSubmit(rankOrder)}
            >
              送信
            </Button>
          </HStack>
        )}
      </Box>
    );
  }

  return null;
}
