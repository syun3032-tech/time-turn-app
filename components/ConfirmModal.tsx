"use client";

import {
  Box,
  Text,
  Button,
  HStack,
  VStack,
} from "@chakra-ui/react";
import { Dialog } from "@chakra-ui/react";

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  confirmColorScheme?: string;
}

export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = "確認",
  cancelText = "キャンセル",
  confirmColorScheme = "red",
}: ConfirmModalProps) {
  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={(e) => !e.open && onClose()}>
      <Dialog.Backdrop />
      <Dialog.Positioner display="flex" alignItems="center" justifyContent="center">
        <Dialog.Content maxW="360px" mx={4} bg="white" borderRadius="xl" boxShadow="xl">
          <Dialog.Header pb={2}>
            <Dialog.Title color="gray.800" fontSize="lg" fontWeight="bold">
              {title}
            </Dialog.Title>
          </Dialog.Header>
          <Dialog.Body py={4}>
            <Text color="gray.700" fontSize="md">
              {message}
            </Text>
          </Dialog.Body>
          <Dialog.Footer pt={2}>
            <HStack gap={3} w="100%">
              <Button
                flex={1}
                variant="outline"
                colorScheme="gray"
                onClick={onClose}
              >
                {cancelText}
              </Button>
              <Button
                flex={1}
                colorScheme={confirmColorScheme}
                onClick={handleConfirm}
              >
                {confirmText}
              </Button>
            </HStack>
          </Dialog.Footer>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
}
