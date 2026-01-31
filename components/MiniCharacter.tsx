"use client";

import { Box } from "@chakra-ui/react";
import { useState, useEffect, useRef } from "react";
import { MiniCharacterChat } from "./MiniCharacterChat";

interface MiniCharacterProps {
  onChatOpenChange?: (isOpen: boolean) => void;
  taskTree?: any[];
  onAddTask?: (parentId: string, title: string) => void;
  onUpdateMemo?: (nodeId: string, memo: string) => void;
}

export function MiniCharacter({ onChatOpenChange, taskTree, onAddTask, onUpdateMemo }: MiniCharacterProps) {
  const [position, setPosition] = useState({ x: 30, y: 150 });
  const [direction, setDirection] = useState<"left" | "right">("right");
  const [isChatOpen, setIsChatOpen] = useState(false);
  const animationRef = useRef<number | null>(null);
  const targetRef = useRef({ x: 30, y: 150 });

  // チャット開閉時に親に通知
  const handleChatOpen = () => {
    setIsChatOpen(true);
    onChatOpenChange?.(true);
  };

  const handleChatClose = () => {
    setIsChatOpen(false);
    onChatOpenChange?.(false);
  };

  // 画面サイズに基づいて移動範囲を計算
  const getSafeBounds = () => {
    if (typeof window === "undefined") return { minX: 0, maxX: 200, minY: 50, maxY: 400 };
    const width = window.innerWidth;
    const height = window.innerHeight;
    const isMobile = width < 768;
    return {
      minX: 0, // 左端まで
      maxX: isMobile ? width - 85 : width - 90, // 右端（キャラ幅分だけ引く）
      minY: 50, // 上の方まで
      maxY: height - 160, // NavTabs上まで
    };
  };

  // 新しいターゲット位置をランダムに決定（斜め移動を強調）
  const pickNewTarget = () => {
    const bounds = getSafeBounds();
    // 現在位置から斜めに移動するようにターゲットを設定
    const currentX = targetRef.current.x;
    const currentY = targetRef.current.y;

    // X方向は小さめの移動（画面幅の20-40%）
    const xRange = (bounds.maxX - bounds.minX) * 0.4;
    const newX = currentX + (Math.random() - 0.5) * xRange;

    // Y方向は大きめの移動（画面高さの30-60%）
    const yRange = (bounds.maxY - bounds.minY) * 0.6;
    const newY = currentY + (Math.random() - 0.5) * yRange;

    targetRef.current = {
      x: Math.min(Math.max(newX, bounds.minX), bounds.maxX),
      y: Math.min(Math.max(newY, bounds.minY), bounds.maxY),
    };
  };

  // 初期位置を画面サイズに合わせて設定
  useEffect(() => {
    const bounds = getSafeBounds();
    const initialX = Math.min(bounds.maxX / 2, 100);
    const initialY = Math.min(bounds.maxY / 2, 200);
    setPosition({ x: initialX, y: initialY });
    targetRef.current = { x: initialX, y: initialY };
  }, []);

  // 壁に当たったら跳ね返るターゲットを設定
  const bounceFromWall = (hitX: boolean, hitY: boolean, currentX: number, currentY: number) => {
    const bounds = getSafeBounds();
    const centerX = (bounds.maxX + bounds.minX) / 2;
    const centerY = (bounds.maxY + bounds.minY) / 2;

    // 跳ね返り先を計算（壁と反対方向へ）
    let newTargetX = targetRef.current.x;
    let newTargetY = targetRef.current.y;

    if (hitX) {
      // X方向で壁に当たった場合、反対方向へ
      const rangeX = (bounds.maxX - bounds.minX) * 0.5;
      if (currentX <= bounds.minX + 5) {
        // 左壁に当たった → 右へ
        newTargetX = currentX + rangeX + Math.random() * rangeX * 0.5;
        setDirection("right");
      } else if (currentX >= bounds.maxX - 5) {
        // 右壁に当たった → 左へ
        newTargetX = currentX - rangeX - Math.random() * rangeX * 0.5;
        setDirection("left");
      }
    }

    if (hitY) {
      // Y方向で壁に当たった場合、反対方向へ
      const rangeY = (bounds.maxY - bounds.minY) * 0.5;
      if (currentY <= bounds.minY + 5) {
        // 上壁に当たった → 下へ
        newTargetY = currentY + rangeY + Math.random() * rangeY * 0.5;
      } else if (currentY >= bounds.maxY - 5) {
        // 下壁に当たった → 上へ
        newTargetY = currentY - rangeY - Math.random() * rangeY * 0.5;
      }
    }

    targetRef.current = {
      x: Math.min(Math.max(newTargetX, bounds.minX + 20), bounds.maxX - 20),
      y: Math.min(Math.max(newTargetY, bounds.minY + 20), bounds.maxY - 20),
    };
  };

  // アニメーションループ
  useEffect(() => {
    const speed = 0.5; // ピクセル/フレーム
    let lastTime = 0;

    const animate = (time: number) => {
      if (lastTime === 0) lastTime = time;
      const delta = time - lastTime;
      lastTime = time;

      if (delta > 0) {
        setPosition((prev) => {
          const bounds = getSafeBounds();
          const dx = targetRef.current.x - prev.x;
          const dy = targetRef.current.y - prev.y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          // ターゲットに到達したら新しいターゲットを設定
          if (distance < 5) {
            // 少し待ってから次の移動
            setTimeout(() => {
              pickNewTarget();
            }, 2000 + Math.random() * 3000);
            return prev;
          }

          // 方向を更新（ある程度の差がある場合のみ）
          if (dx > 10) {
            setDirection("right");
          } else if (dx < -10) {
            setDirection("left");
          }

          // 移動
          const moveX = (dx / distance) * speed * (delta / 16);
          const moveY = (dy / distance) * speed * (delta / 16);

          // 新しい位置を計算
          const rawNewX = prev.x + moveX;
          const rawNewY = prev.y + moveY;

          // 画面内に収める
          const newX = Math.min(Math.max(rawNewX, bounds.minX), bounds.maxX);
          const newY = Math.min(Math.max(rawNewY, bounds.minY), bounds.maxY);

          // 壁に当たったかチェック（位置がクランプされた場合）
          const hitWallX = rawNewX !== newX;
          const hitWallY = rawNewY !== newY;

          if (hitWallX || hitWallY) {
            // 壁に当たったら跳ね返る
            bounceFromWall(hitWallX, hitWallY, newX, newY);
          }

          return { x: newX, y: newY };
        });
      }

      animationRef.current = requestAnimationFrame(animate);
    };

    // 初期ターゲット設定
    const timer = setTimeout(() => {
      pickNewTarget();
      animationRef.current = requestAnimationFrame(animate);
    }, 500);

    return () => {
      clearTimeout(timer);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  // ウィンドウリサイズ時に位置を調整
  useEffect(() => {
    const handleResize = () => {
      const bounds = getSafeBounds();
      setPosition((prev) => ({
        x: Math.min(Math.max(prev.x, bounds.minX), bounds.maxX),
        y: Math.min(Math.max(prev.y, bounds.minY), bounds.maxY),
      }));
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return (
    <>
      <Box
        position="fixed"
        left={`${position.x}px`}
        top={`${position.y}px`}
        width="80px"
        height="142px"
        zIndex={900}
        cursor="pointer"
        onClick={handleChatOpen}
        className={`mini-character ${direction === "right" ? "face-right" : "face-left"}`}
      />
      <MiniCharacterChat
        isOpen={isChatOpen}
        onClose={handleChatClose}
        taskTree={taskTree}
        onAddTask={onAddTask}
        onUpdateMemo={onUpdateMemo}
      />
    </>
  );
}
