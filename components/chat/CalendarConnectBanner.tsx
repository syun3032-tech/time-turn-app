"use client";

import { Box, Text, HStack, Button } from "@chakra-ui/react";
import { FiCalendar } from "react-icons/fi";
import { useAuth } from "@/contexts/AuthContext";

// カレンダー未接続の案内バナー
export function CalendarConnectBanner() {
  const { handleConnectCalendar, calendarConnected } = useAuth();

  if (calendarConnected) return null;
  return (
    <Box
      bg="blue.50"
      border="1px solid"
      borderColor="blue.200"
      borderRadius="lg"
      px={3}
      py={2}
      mb={1}
    >
      <HStack gap={2} justify="space-between">
        <HStack gap={2} flex={1}>
          <Box color="blue.400" flexShrink={0}><FiCalendar size={16} /></Box>
          <Text fontSize="xs" color="blue.700">
            カレンダー連携すると予定も見てくれますよ
          </Text>
        </HStack>
        <Button
          size="xs"
          colorScheme="blue"
          variant="outline"
          flexShrink={0}
          onClick={async () => {
            const result = await handleConnectCalendar();
            if (result.error) {
              console.error("Calendar connect error:", result.error);
            }
          }}
        >
          連携する
        </Button>
      </HStack>
    </Box>
  );
}
