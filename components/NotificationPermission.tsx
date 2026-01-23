"use client";

import { useState, useEffect } from "react";
import {
  Box,
  Button,
  Text,
  VStack,
  HStack,
  IconButton,
} from "@chakra-ui/react";
import { FiX, FiBell, FiBellOff } from "react-icons/fi";
import { CharacterMessage } from "./CharacterMessage";
import {
  isNotificationSupported,
  getNotificationPermission,
  requestNotificationPermission,
  saveFCMToken,
} from "@/lib/firebase/messaging";
import { useAuth } from "@/contexts/AuthContext";

export function NotificationPermission() {
  const { user } = useAuth();
  const [showPrompt, setShowPrompt] = useState(false);
  const [isRequesting, setIsRequesting] = useState(false);

  useEffect(() => {
    // Check if we should show the prompt
    if (!user) return;
    if (!isNotificationSupported()) return;

    const permission = getNotificationPermission();
    if (permission === "granted" || permission === "denied") {
      return;
    }

    // Check if dismissed before
    const dismissed = localStorage.getItem("notification-permission-dismissed");
    const dismissedTime = dismissed ? parseInt(dismissed, 10) : 0;
    const daysSinceDismissed = (Date.now() - dismissedTime) / (1000 * 60 * 60 * 24);

    // Show again after 3 days
    if (dismissedTime && daysSinceDismissed < 3) {
      return;
    }

    // Delay showing the prompt
    const timer = setTimeout(() => {
      setShowPrompt(true);
    }, 5000);

    return () => clearTimeout(timer);
  }, [user]);

  const handleEnable = async () => {
    if (!user) return;

    setIsRequesting(true);
    try {
      const token = await requestNotificationPermission();
      if (token) {
        await saveFCMToken(user.uid, token);
        setShowPrompt(false);
      }
    } catch (error) {
      console.error("Error enabling notifications:", error);
    } finally {
      setIsRequesting(false);
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem("notification-permission-dismissed", Date.now().toString());
  };

  if (!showPrompt) {
    return null;
  }

  return (
    <Box
      position="fixed"
      top={4}
      left={4}
      right={4}
      bg="white"
      borderRadius="xl"
      boxShadow="xl"
      p={4}
      zIndex={1001}
      border="2px solid"
      borderColor="teal.300"
    >
      <HStack justify="space-between" align="start">
        <VStack align="start" gap={3} flex={1}>
          <CharacterMessage
            message="通知をオンにしてくれたら、タスクのリマインドとかお知らせするよ！"
            expression="wawa"
            showAvatar={true}
            avatarSize="small"
          />

          <HStack gap={2}>
            <Button
              colorScheme="teal"
              size="sm"
              onClick={handleEnable}
              loading={isRequesting}
            >
              <FiBell />
              <Text ml={2}>通知を許可する</Text>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDismiss}
            >
              <FiBellOff />
              <Text ml={2}>今はいい</Text>
            </Button>
          </HStack>
        </VStack>

        <IconButton
          aria-label="閉じる"
          size="sm"
          variant="ghost"
          onClick={handleDismiss}
        >
          <FiX />
        </IconButton>
      </HStack>
    </Box>
  );
}
