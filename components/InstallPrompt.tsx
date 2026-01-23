"use client";

import { useState, useEffect } from "react";
import {
  Box,
  Button,
  Text,
  HStack,
  VStack,
  IconButton,
} from "@chakra-ui/react";
import { FiX, FiDownload, FiShare } from "react-icons/fi";
import { CharacterMessage } from "./CharacterMessage";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // Check if already installed
    const standalone = window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    setIsStandalone(standalone);

    // Detect iOS
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent);
    setIsIOS(ios);

    // Check if dismissed before
    const dismissed = localStorage.getItem("pwa-install-dismissed");
    const dismissedTime = dismissed ? parseInt(dismissed, 10) : 0;
    const daysSinceDismissed = (Date.now() - dismissedTime) / (1000 * 60 * 60 * 24);

    // Show again after 7 days
    if (dismissedTime && daysSinceDismissed < 7) {
      return;
    }

    // Listen for beforeinstallprompt
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowPrompt(true);
    };

    window.addEventListener("beforeinstallprompt", handler);

    // For iOS, show custom prompt
    if (ios && !standalone) {
      setTimeout(() => setShowPrompt(true), 3000);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
    };
  }, []);

  const handleInstall = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") {
        setShowPrompt(false);
      }
      setDeferredPrompt(null);
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem("pwa-install-dismissed", Date.now().toString());
  };

  if (isStandalone || !showPrompt) {
    return null;
  }

  return (
    <Box
      position="fixed"
      bottom={4}
      left={4}
      right={4}
      bg="white"
      borderRadius="xl"
      boxShadow="xl"
      p={4}
      zIndex={1000}
      border="2px solid"
      borderColor="teal.300"
    >
      <HStack justify="space-between" align="start">
        <VStack align="start" gap={2} flex={1}>
          <CharacterMessage
            message={
              isIOS
                ? "ホーム画面に追加してくれると、もっと便利に使えるよ！"
                : "アプリをインストールして、いつでも秘書ちゃんに会いに来て！"
            }
            expression="wawa"
            showAvatar={true}
            avatarSize="small"
          />

          {isIOS ? (
            <VStack align="start" gap={1} pl={2}>
              <HStack gap={2}>
                <FiShare />
                <Text fontSize="sm" color="gray.700">
                  1. 下の共有ボタン <FiShare style={{ display: "inline" }} /> をタップ
                </Text>
              </HStack>
              <Text fontSize="sm" color="gray.700" pl={6}>
                2. 「ホーム画面に追加」を選択
              </Text>
            </VStack>
          ) : (
            <Button
              colorScheme="teal"
              size="sm"
              onClick={handleInstall}
            >
              <FiDownload />
              アプリをインストール
            </Button>
          )}
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
