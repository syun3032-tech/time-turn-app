"use client";

import { Box, VStack, Text, Button, Heading } from "@chakra-ui/react";
import { CharacterAvatar } from "@/components/CharacterAvatar";

export default function OfflinePage() {
  const handleRetry = () => {
    window.location.reload();
  };

  return (
    <Box
      minH="100vh"
      bg="#f8fafc"
      display="flex"
      alignItems="center"
      justifyContent="center"
      p={4}
    >
      <VStack gap={6} textAlign="center" maxW="md">
        <CharacterAvatar expression="mewo" width="200px" height="300px" />

        <Heading size="lg" color="gray.800">
          オフラインです
        </Heading>

        <Text color="gray.600">
          インターネットに接続されていないみたい...
          <br />
          接続が回復したら、もう一度試してね！
        </Text>

        <Button colorScheme="teal" onClick={handleRetry}>
          再読み込み
        </Button>
      </VStack>
    </Box>
  );
}
