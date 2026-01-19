"use client";

import {
  Box,
  Button,
  Card,
  Flex,
  Heading,
  HStack,
  Text,
  VStack,
  Badge,
  Stack,
  Textarea,
} from "@chakra-ui/react";
import { CharacterMessage } from "./CharacterMessage";
import { useState } from "react";
import { TaskNode } from "@/types/task-tree";

interface TaskBreakdownPreviewProps {
  proposal: TaskNode[];
  reasoning?: string;
  researchInfo?: string;
  onApprove: () => void;
  onReject: () => void;
  onEdit?: (editedProposal: TaskNode[]) => void;
}

/**
 * タスク分解案のプレビューコンポーネント
 */
export function TaskBreakdownPreview({
  proposal,
  reasoning,
  researchInfo,
  onApprove,
  onReject,
  onEdit,
}: TaskBreakdownPreviewProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedText, setEditedText] = useState("");

  const renderNode = (node: TaskNode, level: number = 0) => {
    const indent = level * 20;
    const hasChildren = node.children && node.children.length > 0;

    // ノードタイプを判定（typeフィールドまたはタイトルプレフィックスで判定）
    const nodeType = node.type
      ? node.type
      : node.title?.startsWith("Goal:")
      ? "Goal"
      : node.title?.startsWith("Project:")
      ? "Project"
      : node.title?.startsWith("Milestone:")
      ? "Milestone"
      : node.title?.startsWith("Task:")
      ? "Task"
      : "Item";

    // 色設定
    const colorScheme =
      nodeType === "Goal"
        ? "purple"
        : nodeType === "Project"
        ? "blue"
        : nodeType === "Milestone"
        ? "teal"
        : "gray";

    return (
      <Box key={node.id} ml={`${indent}px`} mb={2}>
        <Card.Root size="sm" bg={`${colorScheme}.50`} borderLeft="4px solid" borderColor={`${colorScheme}.400`}>
          <Card.Body p={3}>
            <VStack align="stretch" gap={2}>
              <HStack justify="space-between">
                <Text fontWeight="semibold" fontSize="sm">
                  {node.title}
                </Text>
                <Badge colorScheme={colorScheme} size="sm">
                  {nodeType}
                </Badge>
              </HStack>

              {node.description && (
                <Text fontSize="xs" color="gray.600">
                  {node.description}
                </Text>
              )}

              {(node as any).estimatedTime && (
                <HStack gap={2} fontSize="xs" flexWrap="wrap">
                  <Badge size="sm" variant="outline">
                    所要時間: {(node as any).estimatedTime}分
                  </Badge>
                  {(node as any).difficulty && (
                    <Badge size="sm" variant="outline" colorScheme={
                      (node as any).difficulty === "Easy" ? "green" :
                      (node as any).difficulty === "Medium" ? "yellow" : "red"
                    }>
                      難易度: {(node as any).difficulty}
                    </Badge>
                  )}
                  {(node as any).ai && (
                    <Badge size="sm" colorScheme="pink">
                      AI実行可
                    </Badge>
                  )}
                </HStack>
              )}

              {/* 期限表示 */}
              {(node.startDate || node.endDate || (node as any).deadline) && (
                <Text fontSize="xs" color="teal.600">
                  {node.startDate && `開始: ${node.startDate}`}
                  {node.endDate && ` 〜 終了: ${node.endDate}`}
                  {(node as any).deadline && ` 期限: ${(node as any).deadline}`}
                </Text>
              )}

              {/* 成果物・必要スキル */}
              <HStack gap={2} fontSize="xs" flexWrap="wrap">
                {(node as any).outputType && (
                  <Text>成果物: {(node as any).outputType}</Text>
                )}
                {(node as any).requiredSkill && (
                  <Text>必要スキル: {(node as any).requiredSkill}</Text>
                )}
              </HStack>
            </VStack>
          </Card.Body>
        </Card.Root>

        {/* 子ノードを再帰的に表示 */}
        {hasChildren && (
          <Box mt={2}>
            {node.children!.map((child) => renderNode(child, level + 1))}
          </Box>
        )}
      </Box>
    );
  };

  return (
    <Box>
      <CharacterMessage
        message="タスク分解案を作成しました！内容を確認してくださいね。"
        expression="wawa"
        showAvatar={true}
        avatarSize="medium"
      />

      {/* 検索情報の表示 */}
      {researchInfo && (
        <Card.Root mb={4} bg="blue.50">
          <Card.Header>
            <Heading size="sm">📚 検索して得た情報</Heading>
          </Card.Header>
          <Card.Body>
            <Text fontSize="sm" whiteSpace="pre-wrap">
              {researchInfo}
            </Text>
          </Card.Body>
        </Card.Root>
      )}

      {/* タスク分解案の表示 */}
      <Card.Root mb={4}>
        <Card.Header>
          <Heading size="sm">🎯 タスク分解案</Heading>
        </Card.Header>
        <Card.Body>
          <VStack align="stretch" gap={2}>
            {proposal.map((node) => renderNode(node, 0))}
          </VStack>
        </Card.Body>
      </Card.Root>

      {/* 分解の根拠 */}
      {reasoning && (
        <Card.Root mb={4} bg="teal.50">
          <Card.Header>
            <Heading size="sm">💡 分解の根拠</Heading>
          </Card.Header>
          <Card.Body>
            <Text fontSize="sm" whiteSpace="pre-wrap">
              {reasoning}
            </Text>
          </Card.Body>
        </Card.Root>
      )}

      {/* 編集モード */}
      {isEditing && (
        <Card.Root mb={4}>
          <Card.Header>
            <Heading size="sm">✏️ 編集（テキストで調整）</Heading>
          </Card.Header>
          <Card.Body>
            <Textarea
              value={editedText}
              onChange={(e) => setEditedText(e.target.value)}
              minH="200px"
              placeholder="修正したい内容を入力してください"
            />
            <HStack mt={3} gap={2}>
              <Button
                size="sm"
                colorScheme="teal"
                onClick={() => {
                  // TODO: テキストをパースしてproposalに反映
                  if (onEdit) {
                    // onEdit(parsedProposal);
                  }
                  setIsEditing(false);
                }}
              >
                編集を反映
              </Button>
              <Button size="sm" variant="outline" onClick={() => setIsEditing(false)}>
                キャンセル
              </Button>
            </HStack>
          </Card.Body>
        </Card.Root>
      )}

      {/* アクションボタン */}
      <Card.Root>
        <Card.Body>
          <CharacterMessage
            message="この分解で問題ありませんか？粒度は適切ですか？調整したい部分があれば教えてくださいね。"
            expression="open_mouth"
            showAvatar={false}
          />

          <Flex gap={3} mt={4} flexWrap="wrap">
            <Button colorScheme="teal" onClick={onApprove} flex={1} minW="120px">
              ✓ この内容でOK
            </Button>
            <Button
              variant="outline"
              colorScheme="blue"
              onClick={() => setIsEditing(true)}
              flex={1}
              minW="120px"
            >
              ✏️ 編集する
            </Button>
            <Button variant="outline" onClick={onReject} flex={1} minW="120px">
              ✕ やり直す
            </Button>
          </Flex>
        </Card.Body>
      </Card.Root>
    </Box>
  );
}
