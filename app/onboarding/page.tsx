"use client";

import { Box, Text, VStack, HStack, Input, Button, Image } from "@chakra-ui/react";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { getUserProfile, createUserProfile, updateUserProfile, updateStructuredKnowledge } from "@/lib/firebase/firestore";
import { chatWithAISeamless } from "@/lib/ai-service";

// オンボーディング会話のステージ
type Stage = "greeting" | "nickname" | "occupation" | "deep_dive" | "goal_elicit" | "wrapup";

// チャットメッセージ
interface ChatMessage {
  role: "assistant" | "user";
  content: string;
}

// 職業選択肢
const OCCUPATION_OPTIONS = ["大学生", "高校生", "専門学生", "社会人", "フリーター", "主婦/主夫", "その他"];

// オンボーディング用システムプロンプト
const ONBOARDING_SYSTEM_PROMPT = `あなたは「秘書ちゃん」。初めて会うユーザーと自己紹介中。
口うるさいけど面倒見がいい。丁寧語ベース、感情が出ると崩れる。
最大80文字。質問は1つだけ。「目標」「タスク」「計画」という言葉は使わない。
相手の返答に対して短くリアクションするだけ。次の質問はしない。`;

export default function OnboardingPage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  const [stage, setStage] = useState<Stage>("greeting");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isAILoading, setIsAILoading] = useState(false);
  const [nickname, setNickname] = useState("");
  const [occupation, setOccupation] = useState("");
  const [initialGoal, setInitialGoal] = useState("");
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isOccupationCustom, setIsOccupationCustom] = useState(false);
  const [deepDiveRound, setDeepDiveRound] = useState(0); // 0=未開始, 1=1問目回答待ち, 2=2問目回答待ち
  const [deepDiveAnswers, setDeepDiveAnswers] = useState<string[]>([]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // 認証チェック
  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  // 既にプロフィール完了済みならdashboardへ
  useEffect(() => {
    if (!user) return;
    const checkProfile = async () => {
      const profile = await getUserProfile(user.uid);
      if (profile?.profileCompleted) {
        router.push("/dashboard");
      }
    };
    checkProfile();
  }, [user, router]);

  // 自動スクロール
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Stage 0: greeting — 初回挨拶（自動）
  useEffect(() => {
    if (stage !== "greeting") return;
    const timer = setTimeout(() => {
      addAssistantMessage("はじめまして。私、あなたの秘書...みたいなものです。\nまあ、堅いことは抜きにして。気軽にいきましょ。");
      // 1.5秒後に次のステージへ
      setTimeout(() => {
        setStage("nickname");
        addAssistantMessage("で、なんて呼んだらいいですか？");
      }, 1500);
    }, 800);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage]);

  // メッセージ追加ヘルパー
  const addAssistantMessage = (content: string) => {
    setMessages((prev) => [...prev, { role: "assistant", content }]);
  };

  const addUserMessage = (content: string) => {
    setMessages((prev) => [...prev, { role: "user", content }]);
  };

  // AIに短い反応を生成させる
  const getAIReaction = async (context: string): Promise<string> => {
    try {
      const response = await chatWithAISeamless(
        [
          { role: "user", content: `${ONBOARDING_SYSTEM_PROMPT}\n\n${context}` },
        ],
        "gemini"
      );
      if (response.success && response.content) {
        return response.content.replace(/^[「」『』""]/g, "").replace(/[「」『』"""]/g, "").trim();
      }
      throw new Error("AI response failed");
    } catch {
      return "";
    }
  };

  // Stage 1: nickname — ニックネーム入力
  const handleNicknameSubmit = async () => {
    const name = inputValue.trim();
    if (!name) return;

    setNickname(name);
    addUserMessage(name);
    setInputValue("");
    setIsAILoading(true);

    // AI反応を取得（失敗時はフォールバック）
    const reaction = await getAIReaction(
      `ユーザーが「${name}」と名乗りました。「${name}さんね」と認識して、短くリアクションしてください。`
    );
    const reactionText = reaction || `${name}さんね。...覚えましたよ。`;
    addAssistantMessage(reactionText);
    setIsAILoading(false);

    // 次のステージへ
    setTimeout(() => {
      setStage("occupation");
      addAssistantMessage(`${name}さんは普段何してる人？`);
    }, 1200);
  };

  // Stage 2: occupation — 職業クイックリプライ
  const handleOccupationSelect = async (selected: string) => {
    if (selected === "その他") {
      setIsOccupationCustom(true);
      return;
    }
    setOccupation(selected);
    addUserMessage(selected);
    setIsAILoading(true);

    // AI反応を取得（失敗時はフォールバック）
    const reaction = await getAIReaction(
      `ユーザー（${nickname}さん）が職業を「${selected}」と答えました。短くリアクションしてください。`
    );
    const reactionText = reaction || `${selected}か...まあ、色々あるよね。`;
    addAssistantMessage(reactionText);
    setIsAILoading(false);

    // deep_diveへ — AIが属性に応じた質問を生成
    setIsAILoading(true);
    const question = await getAIReaction(
      `ユーザー情報: ${nickname}さん、${selected}。
この人の日常をもっと知りたい。${selected}として具体的に何をしているか1つだけ質問して。
例: 大学生なら「何の勉強してるの？」、社会人なら「どんな仕事してるの？」など。
質問だけ出力。リアクション不要。`
    );
    const questionText = question || getDefaultDeepDiveQuestion(selected);
    addAssistantMessage(questionText);
    setIsAILoading(false);
    setStage("deep_dive");
    setDeepDiveRound(1);
  };

  // 属性に応じたデフォルト深掘り質問
  const getDefaultDeepDiveQuestion = (occ: string): string => {
    if (occ.includes("大学") || occ.includes("専門")) return "何の勉強してるの？";
    if (occ.includes("高校")) return "何年生？部活とかやってる？";
    if (occ.includes("社会人")) return "どんな仕事してるの？";
    return "普段どんなことしてるの？";
  };

  // Stage 2b: occupation custom — テキスト入力
  const handleOccupationCustomSubmit = async () => {
    const custom = inputValue.trim();
    if (!custom) return;
    setInputValue("");
    setIsOccupationCustom(false);
    await handleOccupationSelect(custom);
  };

  // Stage 2c: deep_dive — 深掘り回答
  const handleDeepDiveSubmit = async () => {
    const answer = inputValue.trim();
    if (!answer) return;

    addUserMessage(answer);
    setInputValue("");
    setDeepDiveAnswers((prev) => [...prev, answer]);
    setIsAILoading(true);

    if (deepDiveRound === 1) {
      // 1問目の回答 → リアクション + 2問目（趣味・興味）
      const reaction = await getAIReaction(
        `ユーザー情報: ${nickname}さん、${occupation}。
1問目の回答:「${answer}」
短くリアクションした後、趣味や最近ハマってることを1つだけ聞いて。
例:「へぇ〜！ちなみに最近ハマってることとかある？」
リアクション+質問を1メッセージで。`
      );
      const reactionText = reaction || `なるほどね〜。ちなみに、最近ハマってることとかある？`;
      addAssistantMessage(reactionText);
      setIsAILoading(false);
      setDeepDiveRound(2);
    } else {
      // 2問目の回答 → リアクション → goal_elicitへ
      const reaction = await getAIReaction(
        `ユーザー情報: ${nickname}さん、${occupation}。
趣味/興味:「${answer}」
共感して短くリアクションだけしてください。質問はしない。`
      );
      const reactionText = reaction || "いいね、そういうの。";
      addAssistantMessage(reactionText);
      setIsAILoading(false);

      setTimeout(() => {
        setStage("goal_elicit");
        addAssistantMessage("...ところでさ、ここ開いたってことは何かあるんでしょ？\n別に大したことじゃなくてもいいよ。");
      }, 1200);
    }
  };

  // Stage 3: goal_elicit — 自由入力
  const handleGoalSubmit = async () => {
    const goal = inputValue.trim();
    if (!goal) return;

    setInitialGoal(goal);
    addUserMessage(goal);
    setInputValue("");
    setIsAILoading(true);

    // AI反応を取得（失敗時はフォールバック）
    const reaction = await getAIReaction(
      `ユーザー（${nickname}さん、${occupation}）が気になっていることとして「${goal}」と答えました。
共感して短くリアクションしてください。「一緒にやっていきましょう」的なニュアンスで。`
    );
    const reactionText = reaction || "なるほどね...うん、いいじゃないですか。";
    addAssistantMessage(reactionText);
    setIsAILoading(false);

    // wrapupへ
    setTimeout(() => {
      setStage("wrapup");
      addAssistantMessage(
        `じゃ、これからよろしくね、${nickname}さん。\n何かあったらいつでも話しかけてください。`
      );
    }, 1200);
  };

  // Stage 4: wrapup — 完了して保存
  const handleComplete = async () => {
    if (!user || isTransitioning) return;
    setIsTransitioning(true);

    try {
      const profileData = {
        nickname,
        occupation,
        hobbies: deepDiveAnswers.length > 0 ? deepDiveAnswers.join(" / ") : undefined,
        initialGoal: initialGoal || undefined,
        profileCompleted: true,
        onboardingCompletedAt: new Date(),
      };

      const existing = await getUserProfile(user.uid);
      if (existing) {
        await updateUserProfile(user.uid, profileData);
      } else {
        await createUserProfile(user.uid, user.email || "", profileData);
      }

      // 秘書ちゃんの記憶（構造化ナレッジ）に初期シードを保存（失敗しても続行）
      try {
        await updateStructuredKnowledge(user.uid, {
          basicInfo: occupation ? { occupation } : undefined,
          interests: deepDiveAnswers
            .filter(a => a.trim())
            .map(a => ({ topic: a.trim().slice(0, 50), depth: "mention" as const })),
          concreteGoals: initialGoal ? [{ goal: initialGoal }] : undefined,
          recentContext: {
            summary: `オンボーディング完了。${initialGoal ? `気になっていること: ${initialGoal}` : "初対面の挨拶を交わした"}`,
            mood: "neutral" as const,
          },
        });
      } catch (seedError) {
        console.error("Failed to seed structured knowledge:", seedError);
      }

      router.push("/dashboard");
    } catch (error) {
      console.error("Failed to save profile:", error);
      setIsTransitioning(false);
    }
  };

  // Enter送信ハンドラー
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.nativeEvent.isComposing && inputValue.trim() && !isAILoading) {
      e.preventDefault();
      if (stage === "nickname") handleNicknameSubmit();
      else if (stage === "occupation" && isOccupationCustom) handleOccupationCustomSubmit();
      else if (stage === "deep_dive") handleDeepDiveSubmit();
      else if (stage === "goal_elicit") handleGoalSubmit();
    }
  };

  if (loading || !user) return null;

  return (
    <Box
      bg="white"
      minH="100vh"
      h="100vh"
      display="flex"
      flexDirection="column"
      overflow="hidden"
    >
      {/* チャットエリア */}
      <Box
        ref={scrollRef}
        flex={1}
        overflowY="auto"
        px={{ base: 4, md: 8 }}
        pt={{ base: 6, md: 8 }}
        pb={4}
        display="flex"
        flexDirection="column"
        gap={3}
        css={{
          "&::-webkit-scrollbar": { width: "4px" },
          "&::-webkit-scrollbar-thumb": { background: "rgba(0,0,0,0.15)", borderRadius: "2px" },
        }}
      >
        {messages.map((msg, i) => (
          <HStack
            key={i}
            justify={msg.role === "user" ? "flex-end" : "flex-start"}
            align="flex-end"
            gap={2}
            w="100%"
          >
            {/* 秘書ちゃんアイコン */}
            {msg.role === "assistant" && (
              <Box
                w="36px"
                h="36px"
                borderRadius="full"
                overflow="hidden"
                flexShrink={0}
                border="2px solid"
                borderColor="#ccc"
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
            )}

            {/* 吹き出し */}
            <Box
              bg={msg.role === "user" ? "#A8D8F0" : "#E8E8E8"}
              color="#333"
              px={4}
              py={3}
              borderRadius={
                msg.role === "user"
                  ? "18px 18px 4px 18px"
                  : "18px 18px 18px 4px"
              }
              maxW={{ base: "75%", md: "60%" }}
              boxShadow="0 1px 2px rgba(0,0,0,0.08)"
              position="relative"
            >
              <Text
                fontSize={{ base: "sm", md: "md" }}
                lineHeight="1.7"
                whiteSpace="pre-wrap"
              >
                {msg.content}
              </Text>
            </Box>
          </HStack>
        ))}

        {/* AIローディング */}
        {isAILoading && (
          <HStack justify="flex-start" align="flex-end" gap={2}>
            <Box
              w="36px"
              h="36px"
              borderRadius="full"
              overflow="hidden"
              flexShrink={0}
              border="2px solid"
              borderColor="gray.300"
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
            <Box bg="#E8E8E8" px={4} py={3} borderRadius="18px 18px 18px 4px" boxShadow="sm">
              <HStack gap={1}>
                <Box w="6px" h="6px" borderRadius="full" bg="gray.400" animation="bounce 1.4s infinite ease-in-out" />
                <Box w="6px" h="6px" borderRadius="full" bg="gray.400" animation="bounce 1.4s infinite ease-in-out 0.2s" />
                <Box w="6px" h="6px" borderRadius="full" bg="gray.400" animation="bounce 1.4s infinite ease-in-out 0.4s" />
              </HStack>
            </Box>
          </HStack>
        )}
      </Box>

      {/* 入力エリア */}
      <Box
        bg="white"
        borderTop="1px solid"
        borderColor="#eee"
        px={{ base: 4, md: 8 }}
        py={{ base: 3, md: 4 }}
        flexShrink={0}
      >
        {/* Stage: nickname, goal_elicit, or occupation custom — テキスト入力 */}
        {(stage === "nickname" || stage === "deep_dive" || stage === "goal_elicit" || (stage === "occupation" && isOccupationCustom)) && (
          <HStack gap={2} maxW="600px" mx="auto">
            <Input
              ref={inputRef}
              placeholder={
                stage === "nickname"
                  ? "ニックネームを入力..."
                  : stage === "occupation"
                  ? "例: 浪人生、ニート、フリーランス..."
                  : stage === "deep_dive"
                  ? "気軽に教えてね..."
                  : "気になってること、やりたいこと..."
              }
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isAILoading}
              bg="white"
              borderRadius="full"
              border="none"
              size={{ base: "md", md: "lg" }}
              color="gray.900"
              _placeholder={{ color: "gray.400" }}
            />
            <Button
              colorScheme="teal"
              borderRadius="full"
              size={{ base: "md", md: "lg" }}
              onClick={stage === "nickname" ? handleNicknameSubmit : stage === "occupation" ? handleOccupationCustomSubmit : stage === "deep_dive" ? handleDeepDiveSubmit : handleGoalSubmit}
              disabled={!inputValue.trim() || isAILoading}
              loading={isAILoading}
              px={6}
            >
              送信
            </Button>
          </HStack>
        )}

        {/* Stage: occupation — クイックリプライ */}
        {stage === "occupation" && !isAILoading && !isOccupationCustom && (
          <HStack gap={2} justify="center" flexWrap="wrap" maxW="600px" mx="auto">
            {OCCUPATION_OPTIONS.map((opt) => (
              <Button
                key={opt}
                variant="outline"
                colorScheme="teal"
                borderRadius="full"
                size={{ base: "sm", md: "md" }}
                onClick={() => handleOccupationSelect(opt)}
                _hover={{ bg: "teal.50" }}
              >
                {opt}
              </Button>
            ))}
          </HStack>
        )}

        {/* Stage: wrapup — はじめるボタン */}
        {stage === "wrapup" && (
          <Box maxW="600px" mx="auto">
            <Button
              colorScheme="teal"
              size="lg"
              w="100%"
              borderRadius="full"
              onClick={handleComplete}
              loading={isTransitioning}
              fontSize={{ base: "md", md: "lg" }}
            >
              はじめる
            </Button>
          </Box>
        )}

        {/* Stage: greeting — 待機中 */}
        {stage === "greeting" && (
          <Box textAlign="center" py={2}>
            <Text color="gray.400" fontSize="sm">...</Text>
          </Box>
        )}
      </Box>
    </Box>
  );
}
