"use client";

import { Box, Text, VStack, HStack, Button } from "@chakra-ui/react";
import type { ActionItem } from "@/lib/chat/types";

interface ActionConfirmCardProps {
  actions: ActionItem[];
  actionsConfirmed?: boolean;
  onToggleAction: (actionIndex: number) => void;
  onConfirm: (confirm: boolean) => void;
}

function actionLabel(action: ActionItem): string {
  switch (action.type) {
    case "add_goal": return "Goal";
    case "add_project": return "Project";
    case "add_milestone": return "Milestone";
    case "add_task": return "Task";
    case "add_checklist": return "チェックリスト";
    case "set_completion": return "完了条件設定";
    case "add_calendar_event": return "📅 予定追加";
    case "add_promise": return "約束記録";
    default: return "メモ";
  }
}

function actionBody(action: ActionItem): string {
  if (action.type === "add_checklist") {
    return action.checklistItems?.join("、") ?? "";
  }
  if (action.type === "add_calendar_event") {
    const when = action.calendarStart
      ? ` (${new Date(action.calendarStart).toLocaleString('ja-JP', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })})`
      : "";
    return `${action.title}${when}`;
  }
  if (action.type === "add_promise") {
    return `${action.title}${action.promiseDeadline ? ` (期限: ${action.promiseDeadline})` : ""}`;
  }
  return action.title || action.memo || "";
}

export function ActionConfirmCard({ actions, actionsConfirmed, onToggleAction, onConfirm }: ActionConfirmCardProps) {
  // 確認前: チェックボックス + 実行/キャンセル
  if (actionsConfirmed === undefined) {
    return (
      <VStack align="stretch" mt={2} gap={1}>
        <Box bg="teal.50" p={2} borderRadius="md">
          <Text fontSize="xs" color="teal.700" fontWeight="bold" mb={1}>
            以下を追加しますか？
          </Text>
          <VStack align="stretch" gap={1}>
            {actions.map((action, actionIdx) => (
              <HStack
                key={actionIdx}
                gap={2}
                cursor="pointer"
                onClick={() => onToggleAction(actionIdx)}
                _hover={{ bg: "teal.100" }}
                p={1}
                borderRadius="sm"
              >
                <Box
                  w="16px"
                  h="16px"
                  borderRadius="sm"
                  border="2px solid"
                  borderColor={action.selected ? "teal.500" : "gray.300"}
                  bg={action.selected ? "teal.500" : "transparent"}
                  display="flex"
                  alignItems="center"
                  justifyContent="center"
                  flexShrink={0}
                >
                  {action.selected && (
                    <Text fontSize="10px" color="white" fontWeight="bold">✓</Text>
                  )}
                </Box>
                <Text fontSize="xs" color="gray.700">
                  {actionLabel(action)}: {actionBody(action)}
                  {action.parentTitle && action.type !== "add_calendar_event" && ` (${action.parentTitle}に)`}
                </Text>
              </HStack>
            ))}
          </VStack>
        </Box>
        <HStack gap={2}>
          <Button
            size="xs"
            colorScheme="teal"
            flex={1}
            onClick={() => onConfirm(true)}
            disabled={!actions.some(a => a.selected)}
          >
            追加する ({actions.filter(a => a.selected).length}件)
          </Button>
          <Button
            size="xs"
            variant="ghost"
            flex={1}
            onClick={() => onConfirm(false)}
          >
            やめる
          </Button>
        </HStack>
      </VStack>
    );
  }

  // 確認後の結果表示
  if (actionsConfirmed === true) {
    const succeeded = actions.filter(a => a.selected && a.success).length;
    const failed = actions.filter(a => a.selected && a.success === false).length;
    return (
      <VStack align="stretch" mt={1} gap={0}>
        {succeeded > 0 && (
          <Text fontSize="xs" color="green.500">{succeeded}件追加しました</Text>
        )}
        {failed > 0 && (
          <Text fontSize="xs" color="red.500">{failed}件追加できませんでした</Text>
        )}
      </VStack>
    );
  }

  return <Text fontSize="xs" color="gray.400" mt={1}>キャンセルしました</Text>;
}
