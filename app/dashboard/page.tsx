"use client";

import { Box, Spinner, Flex } from "@chakra-ui/react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { getUserProfile } from "@/lib/firebase/firestore";
import type { UserProfile } from "@/lib/firebase/firestore-types";
import { NavTabs } from "@/components/NavTabs";
import { ChatScreen } from "@/components/chat/ChatScreen";
import { InstallPrompt } from "@/components/InstallPrompt";
import { NotificationPermission } from "@/components/NotificationPermission";

export default function DashboardPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);

  // 認証チェック
  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  // プロフィールを読み込み（未完了ならオンボーディングへ）
  useEffect(() => {
    if (!user) {
      setProfileLoading(false);
      return;
    }

    const loadProfile = async () => {
      try {
        const loaded = await getUserProfile(user.uid);
        if (!loaded || !loaded.profileCompleted) {
          router.push("/onboarding");
          return;
        }
        setProfile(loaded);
      } catch (error) {
        console.error("Failed to load profile:", error);
      } finally {
        setProfileLoading(false);
      }
    };

    loadProfile();
  }, [user, router]);

  if (loading || profileLoading || !user) {
    return (
      <Flex h="100dvh" align="center" justify="center" bg="gray.50">
        <Spinner color="teal.500" size="lg" />
      </Flex>
    );
  }

  return (
    <Box>
      <ChatScreen profile={profile} />
      <NavTabs />
      <InstallPrompt />
      <NotificationPermission />
    </Box>
  );
}
