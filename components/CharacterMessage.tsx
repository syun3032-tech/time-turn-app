"use client";

import { Box, Card, Text } from "@chakra-ui/react";
import { CharacterAvatar, Expression } from "./CharacterAvatar";

interface CharacterMessageProps {
  message: string;
  expression?: Expression;
  showAvatar?: boolean;
  avatarSize?: "small" | "medium" | "large";
}

const AVATAR_SIZES = {
  small: { width: "80px", height: "120px" },
  medium: { width: "150px", height: "225px" },
  large: { width: "200px", height: "300px" },
};

export function CharacterMessage({
  message,
  expression = "open_mouth",
  showAvatar = true,
  avatarSize = "medium",
}: CharacterMessageProps) {
  const size = AVATAR_SIZES[avatarSize];

  return (
    <Box display="flex" gap={4} alignItems="start" mb={4}>
      {showAvatar && (
        <Box flexShrink={0}>
          <CharacterAvatar
            expression={expression}
            width={size.width}
            height={size.height}
          />
        </Box>
      )}
      <Card.Root flex={1} bg="white" boxShadow="sm">
        <Card.Body>
          <Text fontSize="md" lineHeight="1.8">
            {message}
          </Text>
        </Card.Body>
      </Card.Root>
    </Box>
  );
}
