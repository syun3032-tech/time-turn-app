"use client";

import { Box } from "@chakra-ui/react";
import { useState, useEffect, useRef, useCallback } from "react";
import { MiniCharacterChat } from "./MiniCharacterChat";

const STORAGE_KEY = "miniCharacterPosition";
const LONG_PRESS_DURATION = 500; // 長押し判定時間（ms）

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
  const [isDragging, setIsDragging] = useState(false);
  const [isGrabbed, setIsGrabbed] = useState(false); // 長押しでつかんだ状態
  const [isManuallyPositioned, setIsManuallyPositioned] = useState(false);
  const animationRef = useRef<number | null>(null);
  const targetRef = useRef({ x: 30, y: 150 });
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const elementRef = useRef<HTMLDivElement | null>(null);
  const lastDragEndTimeRef = useRef<number>(0); // ドラッグ終了時刻を記録

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

  // 初期位置をlocalStorageから読み込み、なければ画面サイズに合わせて設定
  useEffect(() => {
    const bounds = getSafeBounds();

    // localStorageから保存位置を読み込み
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const savedPos = JSON.parse(saved);
        // 保存位置が有効な範囲内かチェック
        const validX = Math.min(Math.max(savedPos.x, bounds.minX), bounds.maxX);
        const validY = Math.min(Math.max(savedPos.y, bounds.minY), bounds.maxY);
        setPosition({ x: validX, y: validY });
        targetRef.current = { x: validX, y: validY };
        setIsManuallyPositioned(true);
        return;
      }
    } catch (e) {
      console.error("Failed to load saved position:", e);
    }

    const initialX = Math.min(bounds.maxX / 2, 100);
    const initialY = Math.min(bounds.maxY / 2, 200);
    setPosition({ x: initialX, y: initialY });
    targetRef.current = { x: initialX, y: initialY };
  }, []);

  // 位置をlocalStorageに保存
  const savePosition = useCallback((x: number, y: number) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ x, y }));
    } catch (e) {
      console.error("Failed to save position:", e);
    }
  }, []);

  // ドラッグ開始（長押し後）
  const handleDragStart = useCallback((clientX: number, clientY: number) => {
    setIsDragging(true);
    dragOffsetRef.current = {
      x: clientX - position.x,
      y: clientY - position.y,
    };
  }, [position]);

  // ドラッグ中
  const handleDragMove = useCallback((clientX: number, clientY: number) => {
    if (!isDragging) return;

    const bounds = getSafeBounds();
    const newX = Math.min(Math.max(clientX - dragOffsetRef.current.x, bounds.minX), bounds.maxX);
    const newY = Math.min(Math.max(clientY - dragOffsetRef.current.y, bounds.minY), bounds.maxY);

    setPosition({ x: newX, y: newY });
    targetRef.current = { x: newX, y: newY };
  }, [isDragging]);

  // ドラッグ終了
  const handleDragEnd = useCallback(() => {
    if (isDragging) {
      lastDragEndTimeRef.current = Date.now(); // ドラッグ終了時刻を記録
      setIsDragging(false);
      setIsGrabbed(false);
      setIsManuallyPositioned(true);
      savePosition(position.x, position.y);
    }
  }, [isDragging, position, savePosition]);

  // 長押し開始
  const handlePressStart = useCallback((clientX: number, clientY: number) => {
    longPressTimerRef.current = setTimeout(() => {
      setIsGrabbed(true);
      handleDragStart(clientX, clientY);
    }, LONG_PRESS_DURATION);
  }, [handleDragStart]);

  // 長押しキャンセル
  const handlePressCancel = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  // タッチイベント（passive: false で登録するためuseEffectで処理）
  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    const handleTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0];
      handlePressStart(touch.clientX, touch.clientY);
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (isDragging) {
        e.preventDefault(); // passive: false なので動作する
        const touch = e.touches[0];
        handleDragMove(touch.clientX, touch.clientY);
      } else {
        handlePressCancel();
      }
    };

    const handleTouchEnd = () => {
      handlePressCancel();
      handleDragEnd();
    };

    element.addEventListener("touchstart", handleTouchStart, { passive: true });
    element.addEventListener("touchmove", handleTouchMove, { passive: false });
    element.addEventListener("touchend", handleTouchEnd, { passive: true });

    return () => {
      element.removeEventListener("touchstart", handleTouchStart);
      element.removeEventListener("touchmove", handleTouchMove);
      element.removeEventListener("touchend", handleTouchEnd);
    };
  }, [isDragging, handlePressStart, handleDragMove, handlePressCancel, handleDragEnd]);

  // マウスイベント
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    handlePressStart(e.clientX, e.clientY);
  }, [handlePressStart]);

  // グローバルマウスイベント（ドラッグ中）
  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      handleDragMove(e.clientX, e.clientY);
    };

    const handleMouseUp = () => {
      handlePressCancel();
      handleDragEnd();
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, handleDragMove, handleDragEnd, handlePressCancel]);

  // 自動移動をリセット（ダブルタップで）
  const handleDoubleClick = useCallback(() => {
    if (isManuallyPositioned) {
      setIsManuallyPositioned(false);
      localStorage.removeItem(STORAGE_KEY);
      pickNewTarget();
    }
  }, [isManuallyPositioned]);

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

  // アニメーションループ（手動配置またはドラッグ中は停止）
  useEffect(() => {
    // 手動配置中またはドラッグ中は自動移動しない
    if (isManuallyPositioned || isDragging) {
      return;
    }

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
  }, [isManuallyPositioned, isDragging]);

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

  // クリック処理（ドラッグ中でなければチャットを開く）
  const handleClick = useCallback(() => {
    // ドラッグ終了直後（200ms以内）はクリックを無視
    const timeSinceDragEnd = Date.now() - lastDragEndTimeRef.current;
    if (timeSinceDragEnd < 200) {
      return;
    }
    if (!isDragging && !isGrabbed) {
      handleChatOpen();
    }
  }, [isDragging, isGrabbed, handleChatOpen]);

  return (
    <>
      <Box
        ref={elementRef}
        position="fixed"
        left={`${position.x}px`}
        top={`${position.y}px`}
        width="80px"
        height="142px"
        zIndex={900}
        cursor={isGrabbed ? "grabbing" : "pointer"}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        onMouseDown={handleMouseDown}
        className={`mini-character ${direction === "right" ? "face-right" : "face-left"}`}
        style={{
          transform: isGrabbed ? "scale(1.1)" : "scale(1)",
          transition: isDragging ? "none" : "transform 0.2s ease",
          filter: isGrabbed ? "drop-shadow(0 4px 8px rgba(0,0,0,0.3))" : "none",
          touchAction: "none", // タッチ操作のスクロール防止
        }}
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
