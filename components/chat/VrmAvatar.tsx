"use client";

import { Box } from "@chakra-ui/react";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { VRMLoaderPlugin, VRMUtils, type VRM } from "@pixiv/three-vrm";
import type { Expression } from "@/components/CharacterAvatar";

interface VrmAvatarProps {
  /** VRMファイルのURL */
  src: string;
  expression: Expression;
  /** 音声再生中 or タイピング表示中（口パク駆動） */
  talking: boolean;
  height?: string;
  onLoaded?: () => void;
  onLoadError?: () => void;
}

// アプリの表情 → VRM表情プリセットのターゲット値
const EXPRESSION_TARGETS: Record<Expression, Record<string, number>> = {
  normal: {},
  open_mouth: {},
  ookiokutigake: {},
  wawa: { surprised: 0.6, happy: 0.4 },
  niyari: { happy: 0.7 },
  mewo: { relaxed: 1.0 },
};

const VRM_EXPRESSIONS = ["happy", "angry", "sad", "relaxed", "surprised"] as const;

/**
 * three-vrm によるリアルタイム3Dアバター。
 * - 口パク: talking中は擬似音節パターンで「あ」の口形状を駆動
 * - まばたき・呼吸・頭の揺れ・カメラ目線を常時アニメーション
 * - 表情はVRM表情プリセットへ滑らかにブレンド
 */
export function VrmAvatar({ src, expression, talking, height = "100%", onLoaded, onLoadError }: VrmAvatarProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const talkingRef = useRef(talking);
  const expressionRef = useRef(expression);

  useEffect(() => { talkingRef.current = talking; }, [talking]);
  useEffect(() => { expressionRef.current = expression; }, [expression]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let disposed = false;
    let raf = 0;
    let vrm: VRM | null = null;

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(renderer.domElement);
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(25, 1, 0.1, 20);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.6);
    dirLight.position.set(0.5, 1.5, 1.5);
    scene.add(dirLight);
    scene.add(new THREE.AmbientLight(0xffffff, 1.0));

    const resize = () => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (w === 0 || h === 0) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(container);

    const loader = new GLTFLoader();
    loader.register(parser => new VRMLoaderPlugin(parser));

    loader.load(
      src,
      (gltf) => {
        if (disposed) return;
        const loaded = gltf.userData.vrm as VRM | undefined;
        if (!loaded) {
          onLoadError?.();
          return;
        }
        vrm = loaded;
        VRMUtils.removeUnnecessaryVertices(vrm.scene);
        VRMUtils.combineSkeletons(vrm.scene);
        VRMUtils.rotateVRM0(vrm); // VRM0モデルは正面がZ+なので回転
        vrm.scene.traverse(obj => { obj.frustumCulled = false; });
        scene.add(vrm.scene);

        // 腕を下ろす（VRMはTポーズがデフォルト）
        const leftArm = vrm.humanoid.getNormalizedBoneNode("leftUpperArm");
        const rightArm = vrm.humanoid.getNormalizedBoneNode("rightUpperArm");
        if (leftArm) leftArm.rotation.z = 1.15;
        if (rightArm) rightArm.rotation.z = -1.15;

        // カメラを頭に合わせてフレーミング（頭+胸まで）
        const head = vrm.humanoid.getNormalizedBoneNode("head");
        let headY = 1.35;
        if (head) {
          const p = new THREE.Vector3();
          head.updateWorldMatrix(true, false);
          head.getWorldPosition(p);
          headY = p.y;
        }
        camera.position.set(0, headY + 0.02, 0.95);
        camera.lookAt(0, headY - 0.12, 0);

        // カメラ目線
        if (vrm.lookAt) vrm.lookAt.target = camera;

        onLoaded?.();
      },
      undefined,
      (err) => {
        console.error("VRM load failed:", err);
        onLoadError?.();
      }
    );

    // === アニメーションループ ===
    const clock = new THREE.Clock();
    let blinkAt = 2 + Math.random() * 3; // 次のまばたき時刻
    let elapsed = 0;
    const current: Record<string, number> = {}; // 表情の現在値（スムージング用）

    const animate = () => {
      raf = requestAnimationFrame(animate);
      const delta = clock.getDelta();
      elapsed += delta;

      if (vrm) {
        const em = vrm.expressionManager;
        const humanoid = vrm.humanoid;

        // --- 呼吸・頭の揺れ ---
        const spine = humanoid.getNormalizedBoneNode("spine");
        const head = humanoid.getNormalizedBoneNode("head");
        if (spine) spine.rotation.x = Math.sin(elapsed * 1.1) * 0.012;
        if (head) {
          head.rotation.z = Math.sin(elapsed * 0.6) * 0.02;
          head.rotation.x = Math.sin(elapsed * 0.9) * 0.012
            + (talkingRef.current ? Math.sin(elapsed * 5.5) * 0.012 : 0); // 発話中は小さくうなずく
        }

        if (em) {
          // --- 口パク（擬似音節: 2つの周波数を重ねて自然に） ---
          const mouthTarget = talkingRef.current
            ? Math.max(0, Math.abs(Math.sin(elapsed * 8.2)) * (0.55 + 0.45 * Math.sin(elapsed * 2.3)))
            : 0;
          current.aa = (current.aa ?? 0) + (mouthTarget - (current.aa ?? 0)) * Math.min(1, delta * 18);
          em.setValue("aa", current.aa);

          // --- まばたき ---
          if (elapsed > blinkAt) {
            const t = (elapsed - blinkAt) / 0.16; // 160msで1回
            em.setValue("blink", t < 1 ? Math.sin(t * Math.PI) : 0);
            if (t >= 1) blinkAt = elapsed + 1.8 + Math.random() * 3.2;
          }

          // --- 表情ブレンド ---
          const targets = EXPRESSION_TARGETS[expressionRef.current] ?? {};
          for (const name of VRM_EXPRESSIONS) {
            const target = targets[name] ?? 0;
            current[name] = (current[name] ?? 0) + (target - (current[name] ?? 0)) * Math.min(1, delta * 7);
            em.setValue(name, current[name]);
          }
        }

        vrm.update(delta);
      }

      renderer.render(scene, camera);
    };
    animate();

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      if (vrm) {
        scene.remove(vrm.scene);
        VRMUtils.deepDispose(vrm.scene);
      }
      renderer.dispose();
      container.removeChild(renderer.domElement);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);

  return <Box ref={containerRef} h={height} aspectRatio="10 / 13" />;
}
