"use client";

import { Flex, Link as ChakraLink, Text, Box } from "@chakra-ui/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { FiActivity, FiHome, FiList, FiUser } from "react-icons/fi";

const tabs = [
  { href: "/dashboard", label: "ホーム", icon: FiHome },
  { href: "/tasks", label: "目標", icon: FiList },
  { href: "/log", label: "ログ", icon: FiActivity },
  { href: "/profile", label: "プロフィール", icon: FiUser },
];

export function NavTabs() {
  const pathname = usePathname();

  return (
    <Flex
      as="nav"
      position="fixed"
      bottom={0}
      left={0}
      right={0}
      w="100%"
      bg="white"
      borderTop="1px solid"
      borderColor="gray.200"
      px={3}
      py={3}
      justify="space-around"
      align="center"
      zIndex={1000}
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
    </Flex>
  );
}
