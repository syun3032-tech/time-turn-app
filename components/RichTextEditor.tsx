"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import type { Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Placeholder from "@tiptap/extension-placeholder";
import { Box, HStack, Text } from "@chakra-ui/react";
import { FiBold, FiItalic, FiUnderline, FiList, FiMinus } from "react-icons/fi";
import { useEffect } from "react";

export type { Editor };

interface RichTextEditorProps {
  content?: string;
  onChange?: (html: string) => void;
  onEditorReady?: (editor: Editor) => void;
  placeholder?: string;
}

export default function RichTextEditor({
  content = "",
  onChange,
  onEditorReady,
  placeholder = "メモを入力...",
}: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Underline,
      Placeholder.configure({ placeholder }),
    ],
    content,
    immediatelyRender: false,
    onUpdate: ({ editor }) => {
      onChange?.(editor.getHTML());
    },
  });

  useEffect(() => {
    if (editor && onEditorReady) {
      onEditorReady(editor);
    }
  }, [editor, onEditorReady]);

  if (!editor) {
    return null;
  }

  // ツールバーボタン
  const ToolBtn = ({
    active,
    onClick,
    children,
  }: {
    active: boolean;
    onClick: () => void;
    children: React.ReactNode;
  }) => (
    <Box
      as="button"
      px={2}
      py={1.5}
      borderRadius="md"
      bg={active ? "gray.200" : "transparent"}
      color={active ? "gray.800" : "gray.500"}
      _hover={{ bg: active ? "gray.300" : "gray.100" }}
      onClick={onClick}
      transition="all 0.15s"
      display="flex"
      alignItems="center"
      justifyContent="center"
      minW="36px"
    >
      {children}
    </Box>
  );

  return (
    <Box display="flex" flexDirection="column" h="100%">
      {/* 上部ツールバー */}
      <Box
        borderBottom="1px solid"
        borderColor="gray.200"
        bg="gray.50"
        px={2}
        py={1.5}
        flexShrink={0}
      >
        <HStack gap={0.5} justify="center" flexWrap="wrap">
          {/* テキストスタイル */}
          <ToolBtn
            active={editor.isActive("heading", { level: 1 })}
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          >
            <Text fontSize="xs" fontWeight="bold">タイトル</Text>
          </ToolBtn>
          <ToolBtn
            active={editor.isActive("heading", { level: 2 })}
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          >
            <Text fontSize="xs" fontWeight="bold">見出し</Text>
          </ToolBtn>

          {/* 区切り */}
          <Box w="1px" h="20px" bg="gray.300" mx={1} />

          {/* 書式 */}
          <ToolBtn
            active={editor.isActive("bold")}
            onClick={() => editor.chain().focus().toggleBold().run()}
          >
            <FiBold size={16} />
          </ToolBtn>
          <ToolBtn
            active={editor.isActive("italic")}
            onClick={() => editor.chain().focus().toggleItalic().run()}
          >
            <FiItalic size={16} />
          </ToolBtn>
          <ToolBtn
            active={editor.isActive("underline")}
            onClick={() => editor.chain().focus().toggleUnderline().run()}
          >
            <FiUnderline size={16} />
          </ToolBtn>
          <ToolBtn
            active={editor.isActive("strike")}
            onClick={() => editor.chain().focus().toggleStrike().run()}
          >
            <Text fontSize="sm" textDecoration="line-through">S</Text>
          </ToolBtn>

          {/* 区切り */}
          <Box w="1px" h="20px" bg="gray.300" mx={1} />

          {/* リスト */}
          <ToolBtn
            active={editor.isActive("bulletList")}
            onClick={() => editor.chain().focus().toggleBulletList().run()}
          >
            <FiList size={16} />
          </ToolBtn>

          {/* 水平線 */}
          <ToolBtn
            active={false}
            onClick={() => editor.chain().focus().setHorizontalRule().run()}
          >
            <FiMinus size={16} />
          </ToolBtn>
        </HStack>
      </Box>

      {/* エディタ本体 */}
      <Box flex={1} overflow="auto" className="tiptap-editor" p={3}>
        <EditorContent editor={editor} />
      </Box>
    </Box>
  );
}
