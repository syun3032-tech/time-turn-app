"use client";

import { useState } from "react";
import {
  Box,
  Button,
  Input,
  VStack,
  Heading,
  Text,
} from "@chakra-ui/react";

interface ProfileSetupModalProps {
  isOpen: boolean;
  onComplete: (data: { nickname: string; occupation: string }) => void;
}

export function ProfileSetupModal({ isOpen, onComplete }: ProfileSetupModalProps) {
  const [nickname, setNickname] = useState("");
  const [occupation, setOccupation] = useState("");
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async () => {
    if (!nickname.trim()) return;
    setLoading(true);
    try {
      await onComplete({ nickname: nickname.trim(), occupation: occupation.trim() });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      position="fixed"
      top={0}
      left={0}
      right={0}
      bottom={0}
      bg="rgba(0,0,0,0.5)"
      display="flex"
      alignItems="center"
      justifyContent="center"
      zIndex={2000}
      p={4}
    >
      <Box
        bg="white"
        borderRadius="xl"
        p={6}
        w="full"
        maxW="400px"
        boxShadow="xl"
      >
        <VStack gap={5} align="stretch">
          <Box textAlign="center">
            <Heading size="lg" color="black" mb={2}>ようこそ!</Heading>
            <Text color="gray.600" fontSize="sm">
              あなたのことを教えてください
            </Text>
          </Box>

          <VStack gap={4} align="stretch">
            <Box>
              <Text fontSize="sm" fontWeight="semibold" color="black" mb={1}>
                ニックネーム <Text as="span" color="red.500">*</Text>
              </Text>
              <Input
                placeholder="例: たろう"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                size="lg"
                color="black"
              />
            </Box>

            <Box>
              <Text fontSize="sm" fontWeight="semibold" color="black" mb={1}>
                職業・立場（任意）
              </Text>
              <Input
                placeholder="例: 学生、エンジニア、主婦"
                value={occupation}
                onChange={(e) => setOccupation(e.target.value)}
                size="lg"
                color="black"
              />
            </Box>
          </VStack>

          <Button
            colorScheme="teal"
            size="lg"
            onClick={handleSubmit}
            loading={loading}
            disabled={!nickname.trim()}
          >
            はじめる
          </Button>
        </VStack>
      </Box>
    </Box>
  );
}
