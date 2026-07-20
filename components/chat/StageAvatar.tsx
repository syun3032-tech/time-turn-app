"use client";

import { useEffect, useState } from "react";
import { Box } from "@chakra-ui/react";
import dynamic from "next/dynamic";
import type { Expression } from "@/components/CharacterAvatar";
import { YuriAvatar } from "./YuriAvatar";

// ここにVRMファイルを置くと3Dゆりに自動で切り替わる（無ければPNG版で動く）
export const VRM_PATH = "/models/yuri.vrm";

// three.jsは重いのでVRMがある時だけ動的ロード
const VrmAvatar = dynamic(() => import("./VrmAvatar").then(m => m.VrmAvatar), { ssr: false });

interface StageAvatarProps {
  expression: Expression;
  talking: boolean;
  height?: string;
}

/**
 * ステージ上のゆり本体。
 * VRMモデル（public/models/yuri.vrm）があれば3D、無ければPNGTuber版にフォールバック。
 * VRM読み込み中もPNG版を表示してシームレスに切り替える。
 */
export function StageAvatar({ expression, talking, height = "100%" }: StageAvatarProps) {
  const [vrmAvailable, setVrmAvailable] = useState<boolean | null>(null);
  const [vrmReady, setVrmReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(VRM_PATH, { method: "HEAD" })
      .then(res => { if (!cancelled) setVrmAvailable(res.ok); })
      .catch(() => { if (!cancelled) setVrmAvailable(false); });
    return () => { cancelled = true; };
  }, []);

  if (!vrmAvailable) {
    return <YuriAvatar expression={expression} talking={talking} height={height} />;
  }

  return (
    <Box position="relative" h={height} aspectRatio="10 / 13">
      {/* VRM準備完了までPNG版を表示 */}
      {!vrmReady && (
        <Box position="absolute" inset={0}>
          <YuriAvatar expression={expression} talking={talking} height="100%" />
        </Box>
      )}
      <Box position="absolute" inset={0} opacity={vrmReady ? 1 : 0} transition="opacity 0.4s">
        <VrmAvatar
          src={VRM_PATH}
          expression={expression}
          talking={talking}
          height="100%"
          onLoaded={() => setVrmReady(true)}
          onLoadError={() => { setVrmAvailable(false); setVrmReady(false); }}
        />
      </Box>
    </Box>
  );
}
