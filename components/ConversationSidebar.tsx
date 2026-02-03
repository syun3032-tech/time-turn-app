"use client";

import {
  Box,
  Text,
  VStack,
  HStack,
  Button,
  Input,
  IconButton,
  Badge,
  Image,
} from "@chakra-ui/react";
import { FiPlus, FiEdit2, FiCheck, FiX, FiTrash2, FiMessageCircle } from "react-icons/fi";
import { useState } from "react";
import type { Conversation } from "@/lib/firebase/firestore-types";
import { ConfirmModal } from "./ConfirmModal";

interface ConversationSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  conversations: Conversation[];
  currentConversationId: string | null;
  onSelectConversation: (id: string) => void;
  onNewConversation: () => void;
  onUpdateTitle: (id: string, title: string) => void;
  onDeleteConversation: (id: string) => void;
}

export function ConversationSidebar({
  isOpen,
  onClose,
  conversations,
  currentConversationId,
  onSelectConversation,
  onNewConversation,
  onUpdateTitle,
  onDeleteConversation,
}: ConversationSidebarProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  const handleStartEdit = (conv: Conversation) => {
    setEditingId(conv.id);
    setEditingTitle(conv.title);
  };

  const handleSaveEdit = () => {
    if (editingId && editingTitle.trim()) {
      onUpdateTitle(editingId, editingTitle.trim());
    }
    setEditingId(null);
    setEditingTitle("");
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditingTitle("");
  };

  const formatDate = (date: Date) => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const targetDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const diffDays = Math.floor((today.getTime() - targetDate.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return "今日";
    if (diffDays === 1) return "昨日";
    if (diffDays < 7) return `${diffDays}日前`;
    return date.toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' });
  };

  return (
    <>
      {/* オーバーレイ */}
      {isOpen && (
        <Box
          position="fixed"
          top={0}
          left={0}
          right={0}
          bottom={0}
          bg="blackAlpha.600"
          zIndex={998}
          onClick={onClose}
          backdropFilter="blur(4px)"
        />
      )}

      {/* サイドバー - ゲームUI風 */}
      <Box
        position="fixed"
        top={0}
        left={0}
        h="100vh"
        w="300px"
        bgGradient="linear(to-b, #1a1a2e, #16213e, #0f3460)"
        boxShadow="0 0 40px rgba(99, 179, 237, 0.3)"
        zIndex={999}
        transform={isOpen ? "translateX(0)" : "translateX(-100%)"}
        transition="transform 0.3s ease"
        display="flex"
        flexDirection="column"
        borderRight="2px solid"
        borderColor="cyan.400"
      >
        {/* ヘッダー - キャラクター表示 */}
        <Box
          p={4}
          bgGradient="linear(to-r, rgba(99, 179, 237, 0.2), rgba(159, 122, 234, 0.2))"
          borderBottom="1px solid"
          borderColor="whiteAlpha.200"
          position="relative"
          overflow="hidden"
        >
          {/* 装飾ライン */}
          <Box
            position="absolute"
            top={0}
            left={0}
            right={0}
            h="2px"
            bgGradient="linear(to-r, transparent, cyan.400, purple.400, transparent)"
          />

          <HStack justify="space-between" mb={4}>
            <HStack gap={3}>
              {/* キャラアイコン */}
              <Box
                w="50px"
                h="50px"
                borderRadius="full"
                overflow="hidden"
                border="2px solid"
                borderColor="cyan.400"
                boxShadow="0 0 15px rgba(99, 179, 237, 0.5)"
              >
                <Image
                  src="/hisyochan-icon.png"
                  alt="秘書ちゃん"
                  w="100%"
                  h="100%"
                  objectFit="cover"
                  objectPosition="center top"
                />
              </Box>
              <VStack align="start" gap={0}>
                <Text
                  fontWeight="bold"
                  fontSize="lg"
                  color="white"
                  textShadow="0 0 10px rgba(99, 179, 237, 0.5)"
                >
                  会話履歴
                </Text>
                <Text fontSize="xs" color="cyan.200">
                  Chat History
                </Text>
              </VStack>
            </HStack>
            <IconButton
              aria-label="閉じる"
              size="sm"
              variant="ghost"
              color="whiteAlpha.800"
              _hover={{ bg: "whiteAlpha.200", color: "white" }}
              onClick={onClose}
            >
              <FiX size={20} />
            </IconButton>
          </HStack>

          {/* 新規会話ボタン */}
          <Button
            w="100%"
            size="md"
            bg="linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
            color="white"
            _hover={{
              bg: "linear-gradient(135deg, #764ba2 0%, #667eea 100%)",
              transform: "translateY(-2px)",
              boxShadow: "0 5px 20px rgba(102, 126, 234, 0.5)",
            }}
            _active={{ transform: "translateY(0)" }}
            transition="all 0.2s"
            borderRadius="xl"
            fontWeight="bold"
            boxShadow="0 4px 15px rgba(102, 126, 234, 0.3)"
            onClick={() => {
              onNewConversation();
              onClose();
            }}
          >
            <FiPlus />
            <Text ml={2}>新しい会話</Text>
          </Button>
        </Box>

        {/* 会話一覧 */}
        <Box
          flex={1}
          overflowY="auto"
          p={3}
          css={{
            "&::-webkit-scrollbar": {
              width: "6px",
            },
            "&::-webkit-scrollbar-track": {
              background: "rgba(255,255,255,0.1)",
              borderRadius: "3px",
            },
            "&::-webkit-scrollbar-thumb": {
              background: "linear-gradient(to-b, #667eea, #764ba2)",
              borderRadius: "3px",
            },
          }}
        >
          <VStack gap={2} align="stretch">
            {conversations.length === 0 ? (
              <Box
                textAlign="center"
                py={8}
                px={4}
              >
                <Box
                  w="60px"
                  h="60px"
                  mx="auto"
                  mb={3}
                  borderRadius="full"
                  bg="whiteAlpha.100"
                  display="flex"
                  alignItems="center"
                  justifyContent="center"
                >
                  <FiMessageCircle size={30} color="#63b3ed" />
                </Box>
                <Text fontSize="sm" color="whiteAlpha.600">
                  会話履歴がありません
                </Text>
                <Text fontSize="xs" color="whiteAlpha.400" mt={1}>
                  新しい会話を始めましょう
                </Text>
              </Box>
            ) : (
              conversations.map((conv) => {
                const isSelected = currentConversationId === conv.id;
                return (
                  <Box
                    key={conv.id}
                    p={3}
                    borderRadius="xl"
                    bg={isSelected
                      ? "linear-gradient(135deg, rgba(99, 179, 237, 0.3), rgba(159, 122, 234, 0.3))"
                      : "whiteAlpha.50"
                    }
                    border="1px solid"
                    borderColor={isSelected ? "cyan.400" : "whiteAlpha.100"}
                    boxShadow={isSelected
                      ? "0 0 20px rgba(99, 179, 237, 0.3), inset 0 0 20px rgba(99, 179, 237, 0.1)"
                      : "none"
                    }
                    _hover={{
                      bg: isSelected
                        ? "linear-gradient(135deg, rgba(99, 179, 237, 0.4), rgba(159, 122, 234, 0.4))"
                        : "whiteAlpha.100",
                      borderColor: isSelected ? "cyan.300" : "whiteAlpha.300",
                      transform: "translateX(4px)",
                    }}
                    cursor="pointer"
                    transition="all 0.2s"
                    position="relative"
                    overflow="hidden"
                  >
                    {/* 選択時の光るエフェクト */}
                    {isSelected && (
                      <Box
                        position="absolute"
                        top={0}
                        left={0}
                        w="3px"
                        h="100%"
                        bgGradient="linear(to-b, cyan.400, purple.400)"
                        boxShadow="0 0 10px rgba(99, 179, 237, 0.8)"
                      />
                    )}

                    {editingId === conv.id ? (
                      <HStack>
                        <Input
                          size="sm"
                          value={editingTitle}
                          onChange={(e) => setEditingTitle(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleSaveEdit();
                            if (e.key === "Escape") handleCancelEdit();
                          }}
                          bg="whiteAlpha.200"
                          border="1px solid"
                          borderColor="cyan.400"
                          color="white"
                          _focus={{ borderColor: "purple.400", boxShadow: "0 0 10px rgba(159, 122, 234, 0.5)" }}
                          autoFocus
                        />
                        <IconButton
                          aria-label="保存"
                          size="xs"
                          bg="green.500"
                          color="white"
                          _hover={{ bg: "green.400" }}
                          onClick={handleSaveEdit}
                        >
                          <FiCheck />
                        </IconButton>
                        <IconButton
                          aria-label="キャンセル"
                          size="xs"
                          variant="ghost"
                          color="whiteAlpha.700"
                          _hover={{ bg: "whiteAlpha.200" }}
                          onClick={handleCancelEdit}
                        >
                          <FiX />
                        </IconButton>
                      </HStack>
                    ) : (
                      <HStack
                        onClick={() => {
                          onSelectConversation(conv.id);
                          onClose();
                        }}
                      >
                        <VStack align="start" gap={1} flex={1}>
                          <HStack gap={2}>
                            <Text
                              fontSize="sm"
                              fontWeight={isSelected ? "bold" : "medium"}
                              color={isSelected ? "white" : "whiteAlpha.900"}
                              lineClamp={1}
                              textShadow={isSelected ? "0 0 10px rgba(255,255,255,0.3)" : "none"}
                            >
                              {conv.title}
                            </Text>
                            {conv.source === 'mini' && (
                              <Badge
                                size="sm"
                                bg="linear-gradient(135deg, #f093fb, #f5576c)"
                                color="white"
                                borderRadius="full"
                                px={2}
                                fontSize="10px"
                              >
                                ミニ
                              </Badge>
                            )}
                          </HStack>
                          <Text fontSize="xs" color="whiteAlpha.500">
                            {formatDate(conv.updatedAt)}
                          </Text>
                        </VStack>
                        <HStack gap={1} onClick={(e) => e.stopPropagation()}>
                          <IconButton
                            aria-label="編集"
                            size="xs"
                            variant="ghost"
                            color="whiteAlpha.500"
                            _hover={{ color: "cyan.300", bg: "whiteAlpha.100" }}
                            onClick={() => handleStartEdit(conv)}
                          >
                            <FiEdit2 size={14} />
                          </IconButton>
                          <IconButton
                            aria-label="削除"
                            size="xs"
                            variant="ghost"
                            color="whiteAlpha.500"
                            _hover={{ color: "red.400", bg: "whiteAlpha.100" }}
                            onClick={() => setDeleteTargetId(conv.id)}
                          >
                            <FiTrash2 size={14} />
                          </IconButton>
                        </HStack>
                      </HStack>
                    )}
                  </Box>
                );
              })
            )}
          </VStack>
        </Box>

        {/* フッター装飾 */}
        <Box
          p={3}
          borderTop="1px solid"
          borderColor="whiteAlpha.100"
          bgGradient="linear(to-r, rgba(99, 179, 237, 0.1), rgba(159, 122, 234, 0.1))"
        >
          <Text fontSize="xs" color="whiteAlpha.400" textAlign="center">
            TimeTurn - 秘書ちゃんと一緒に
          </Text>
        </Box>
      </Box>

      {/* 削除確認モーダル */}
      <ConfirmModal
        isOpen={deleteTargetId !== null}
        onClose={() => setDeleteTargetId(null)}
        onConfirm={() => {
          if (deleteTargetId) {
            onDeleteConversation(deleteTargetId);
          }
        }}
        title="会話を削除"
        message="この会話を削除しますか？削除すると元に戻せません。"
        confirmText="削除する"
        cancelText="キャンセル"
        confirmColorScheme="red"
      />
    </>
  );
}
