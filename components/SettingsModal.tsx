"use client";

import { useState, useEffect } from "react";
import {
  Box,
  Button,
  Input,
  VStack,
  Heading,
  Text,
  HStack,
} from "@chakra-ui/react";
import { FiX } from "react-icons/fi";
import type { UserProfile } from "@/lib/firebase/firestore-types";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: UserProfile | null;
  onSave: (data: { nickname: string; occupation: string }) => Promise<void>;
}

export function SettingsModal({ isOpen, onClose, profile, onSave }: SettingsModalProps) {
  const [nickname, setNickname] = useState("");
  const [occupation, setOccupation] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (profile) {
      setNickname(profile.nickname || "");
      setOccupation(profile.occupation || "");
    }
  }, [profile]);

  if (!isOpen) return null;

  const handleSave = async () => {
    if (!nickname.trim()) return;
    setLoading(true);
    try {
      await onSave({ nickname: nickname.trim(), occupation: occupation.trim() });
      onClose();
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
      onClick={onClose}
    >
      <Box
        bg="white"
        borderRadius="xl"
        p={6}
        w="full"
        maxW="400px"
        boxShadow="xl"
        onClick={(e) => e.stopPropagation()}
      >
        <VStack gap={5} align="stretch">
          <HStack justify="space-between" align="center">
            <Heading size="md" color="black">設定</Heading>
            <Box
              cursor="pointer"
              color="gray.500"
              onClick={onClose}
              _hover={{ color: "gray.700" }}
            >
              <FiX size={24} />
            </Box>
          </HStack>

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

            <Box>
              <Text fontSize="sm" fontWeight="semibold" color="black" mb={1}>
                メールアドレス
              </Text>
              <Input
                value={profile?.email || ""}
                size="lg"
                color="gray.500"
                disabled
                bg="gray.100"
              />
            </Box>
          </VStack>

          <HStack gap={3}>
            <Button
              variant="outline"
              size="lg"
              flex={1}
              onClick={onClose}
            >
              キャンセル
            </Button>
            <Button
              colorScheme="teal"
              size="lg"
              flex={1}
              onClick={handleSave}
              loading={loading}
              disabled={!nickname.trim()}
            >
              保存
            </Button>
          </HStack>
        </VStack>
      </Box>
    </Box>
  );
}
