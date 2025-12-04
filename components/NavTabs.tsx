"use client";

import { Flex, Link as ChakraLink, Text, Box } from "@chakra-ui/react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { FiActivity, FiHome, FiList, FiUser, FiLogOut } from "react-icons/fi";
import { signOut } from "@/lib/firebase/auth";

const tabs = [
  { href: "/dashboard", label: "ホーム", icon: FiHome },
  { href: "/tasks", label: "タスク", icon: FiList },
  { href: "/log", label: "ログ", icon: FiActivity },
  { href: "/profile", label: "プロフィール", icon: FiUser },
];

export function NavTabs() {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await signOut();
      router.push('/login');
    } catch (error) {
      console.error("Failed to sign out:", error);
    }
  };

  return (
    <Flex
      as="nav"
      position="sticky"
      bottom={0}
      bg="white"
      borderTop="1px solid"
      borderColor="gray.200"
      px={3}
      py={3}
      justify="space-between"
      align="center"
      zIndex={10}
    >
      {tabs.map((tab) => {
        const active = pathname?.startsWith(tab.href);
        return (
          <ChakraLink
            key={tab.href}
            as={Link}
            href={tab.href}
            display="flex"
            flexDir="column"
            alignItems="center"
            justifyContent="center"
            gap={1}
            fontSize="xs"
            color={active ? "teal.600" : "gray.500"}
            _hover={{ textDecoration: "none", color: "teal.600" }}
          >
            <Box as={tab.icon} boxSize={6} strokeWidth={2} />
            <Text fontSize="xs" fontWeight={active ? "semibold" : "normal"}>
              {tab.label}
            </Text>
          </ChakraLink>
        );
      })}
      <Box
        display="flex"
        flexDir="column"
        alignItems="center"
        justifyContent="center"
        gap={1}
        fontSize="xs"
        color="red.500"
        cursor="pointer"
        onClick={handleLogout}
        _hover={{ color: "red.600" }}
      >
        <Box as={FiLogOut} boxSize={6} strokeWidth={2} />
        <Text fontSize="xs" fontWeight="normal">
          ログアウト
        </Text>
      </Box>
    </Flex>
  );
}
