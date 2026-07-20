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
import { FiX, FiCalendar } from "react-icons/fi";
import type { UserProfile } from "@/lib/firebase/firestore-types";
import { useAuth } from "@/contexts/AuthContext";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: UserProfile | null;
  onSave: (data: { nickname: string; occupation: string; hobbies: string }) => Promise<void>;
  onLogout: () => void;
}

export function SettingsModal({ isOpen, onClose, profile, onSave, onLogout }: SettingsModalProps) {
  const [nickname, setNickname] = useState("");
  const [occupation, setOccupation] = useState("");
  const [hobbies, setHobbies] = useState("");
  const [loading, setLoading] = useState(false);
  const { calendarConnected, handleConnectCalendar } = useAuth();
  const [calendarLoading, setCalendarLoading] = useState(false);

  useEffect(() => {
    if (profile) {
      setNickname(profile.nickname || "");
      setOccupation(profile.occupation || "");
      setHobbies(profile.hobbies || "");
    }
  }, [profile]);

  if (!isOpen) return null;

  const handleSave = async () => {
    if (!nickname.trim()) return;
    setLoading(true);
    try {
      await onSave({ nickname: nickname.trim(), occupation: occupation.trim(), hobbies: hobbies.trim() });
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
                趣味・好きなこと（任意）
              </Text>
              <Input
                placeholder="例: 読書、ゲーム、料理"
                value={hobbies}
                onChange={(e) => setHobbies(e.target.value)}
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

          <Box borderTop="1px solid" borderColor="gray.200" pt={4} mt={2}>
            <HStack justify="space-between" align="center" mb={4}>
              <HStack gap={2}>
                <Box color={calendarConnected ? "green.500" : "gray.500"}><FiCalendar size={18} /></Box>
                <VStack align="start" gap={0}>
                  <Text fontSize="sm" fontWeight="semibold" color="black">Googleカレンダー</Text>
                  <Text fontSize="xs" color={calendarConnected ? "green.500" : "gray.400"}>
                    {calendarConnected ? "接続済み" : "未接続"}
                  </Text>
                </VStack>
              </HStack>
              {!calendarConnected && (
                <Button
                  size="sm"
                  colorScheme="blue"
                  variant="outline"
                  loading={calendarLoading}
                  onClick={async () => {
                    setCalendarLoading(true);
                    try {
                      const result = await handleConnectCalendar();
                      if (result.error) console.error("Calendar connect error:", result.error);
                    } finally {
                      setCalendarLoading(false);
                    }
                  }}
                >
                  連携する
                </Button>
              )}
            </HStack>
            <Button
              colorScheme="red"
              variant="outline"
              size="md"
              w="full"
              onClick={onLogout}
            >
              ログアウト
            </Button>
            {/* 3Dモデルのクレジット表記（利用規約で必須） */}
            <Text fontSize="10px" color="gray.400" mt={3} textAlign="center">
              3Dモデル: フリー素材キャラクター「つくよみちゃん」公式3Dモデル タイプA（© Rei Yumesaki）
              https://tyc.rei-yumesaki.net/
            </Text>
          </Box>
        </VStack>
      </Box>
    </Box>
  );
}
