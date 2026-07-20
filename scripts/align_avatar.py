#!/usr/bin/env python3
"""秘書ゆりの立ち絵を口パク・表情切替用に同一構図へ整列するツール。

各画像から「頭頂」「顔（肌色領域）の中心・幅」を検出し、
全画像で顔が同じ位置・同じ大きさになるよう1000x1300キャンバスに再配置する。
背景はエッジからのフラッドフィルで透過化する。

usage: python3 scripts/align_avatar.py
出力: public/yuri/*.png と比較用シート scripts/align_preview.png
"""

import os
from collections import deque

import numpy as np
from PIL import Image

SRC_DIR = os.path.join(os.path.dirname(__file__), "..", "public")
OUT_DIR = os.path.join(SRC_DIR, "yuri")

# 出力キャンバスと顔の配置ターゲット
CANVAS_W, CANVAS_H = 1000, 1300
TARGET_FACE_W = 310          # 顔幅(px)
TARGET_FACE_CX = 500         # 顔中心x
TARGET_HEAD_TOP = 130        # 頭頂y

SOURCES = {
    "normal": "秘書ゆり_ノーマル.png",
    "mouth_half": "秘書ゆり_お口開けた.png",
    "mouth_wide": "秘書ゆり_大きなお口.png",
    "eyes_closed": "秘書ゆり_目を閉じた.png",
    "niyari": "秘書ゆり_ニヤリ.png",
    "wawa": "わわ_秘書ゆり.png",
}


def analyze(img: Image.Image):
    """頭頂y・顔中心x・顔幅を検出する"""
    a = np.asarray(img.convert("RGB"), dtype=np.int16)
    h, w, _ = a.shape
    r, g, b = a[..., 0], a[..., 1], a[..., 2]

    # 髪・スーツなどの暗部
    dark = (r + g + b) < 240
    dark_rows = dark.sum(axis=1)
    head_top = int(np.argmax(dark_rows > w * 0.02))

    # 肌色: 明るめ・赤み優位・背景(無彩色の白)を除外
    skin = (r > 175) & (g > 130) & (b > 105) & ((r - b) > 18) & ((r - g) > 5) & (r < 255)
    # 顔は上半分にある前提でノイズ除去
    skin[int(h * 0.65):, :] = False

    ys, xs = np.nonzero(skin)
    if len(xs) < 100:
        raise RuntimeError("skin region not found")
    # 外れ値に頑健なパーセンタイルbbox
    x0, x1 = np.percentile(xs, [2, 98])
    face_cx = (x0 + x1) / 2
    face_w = x1 - x0
    return head_top, face_cx, face_w


def remove_background(img: Image.Image) -> Image.Image:
    """エッジからのBFSフラッドフィルで背景を透過化"""
    rgb = np.asarray(img.convert("RGB"), dtype=np.int16)
    h, w, _ = rgb.shape

    # 四隅から背景色を推定
    corners = np.concatenate([
        rgb[:10, :10].reshape(-1, 3), rgb[:10, -10:].reshape(-1, 3),
        rgb[-10:, :10].reshape(-1, 3), rgb[-10:, -10:].reshape(-1, 3),
    ])
    bg = corners.mean(axis=0)

    diff = np.abs(rgb - bg).sum(axis=2)
    similar = diff < 90  # 背景に近い色

    # エッジに接する背景類似領域だけをBFSで塗る（目のハイライト等の内部白は残す）
    visited = np.zeros((h, w), dtype=bool)
    dq = deque()
    for x in range(w):
        for y in (0, h - 1):
            if similar[y, x] and not visited[y, x]:
                visited[y, x] = True
                dq.append((y, x))
    for y in range(h):
        for x in (0, w - 1):
            if similar[y, x] and not visited[y, x]:
                visited[y, x] = True
                dq.append((y, x))
    while dq:
        y, x = dq.popleft()
        for ny, nx in ((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)):
            if 0 <= ny < h and 0 <= nx < w and similar[ny, nx] and not visited[ny, nx]:
                visited[ny, nx] = True
                dq.append((ny, nx))

    alpha = np.where(visited, 0, 255).astype(np.uint8)
    # 1pxフェザー（境界のギザギザ緩和）: 4近傍平均
    af = alpha.astype(np.float32)
    pad = np.pad(af, 1, mode="edge")
    af = (pad[:-2, 1:-1] + pad[2:, 1:-1] + pad[1:-1, :-2] + pad[1:-1, 2:] + af * 4) / 8
    alpha = af.astype(np.uint8)

    out = img.convert("RGBA")
    out.putalpha(Image.fromarray(alpha))
    return out


def align(img: Image.Image, head_top: int, face_cx: float, face_w: float) -> Image.Image:
    scale = TARGET_FACE_W / face_w
    new_w, new_h = int(img.width * scale), int(img.height * scale)
    resized = img.resize((new_w, new_h), Image.LANCZOS)

    canvas = Image.new("RGBA", (CANVAS_W, CANVAS_H), (0, 0, 0, 0))
    px = int(TARGET_FACE_CX - face_cx * scale)
    py = int(TARGET_HEAD_TOP - head_top * scale)
    canvas.paste(resized, (px, py), resized)
    return canvas


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    results = {}
    for key, fname in SOURCES.items():
        path = os.path.join(SRC_DIR, fname)
        img = Image.open(path)
        head_top, face_cx, face_w = analyze(img)
        print(f"{key:12s} {img.width}x{img.height} head_top={head_top} face_cx={face_cx:.0f} face_w={face_w:.0f}")
        rgba = remove_background(img)
        aligned = align(rgba, head_top, face_cx, face_w)
        # 配信用は軽量なWebP（750x975, 40KB前後）のみ出力する
        out_path = os.path.join(OUT_DIR, f"{key}.webp")
        aligned.resize((750, 975), Image.LANCZOS).save(out_path, "WEBP", quality=82, method=6)
        results[key] = aligned

    # 比較シート: 6枚並べ + normal/mouth_half の重ね合わせで整列確認
    thumb_w, thumb_h = 250, 325
    sheet = Image.new("RGB", (thumb_w * 7, thumb_h), (70, 70, 90))
    for i, (key, im) in enumerate(results.items()):
        sheet.paste(im.resize((thumb_w, thumb_h)), (i * thumb_w, 0), im.resize((thumb_w, thumb_h)))
    overlay = Image.blend(
        results["normal"].convert("RGBA"), results["mouth_half"].convert("RGBA"), 0.5
    ).resize((thumb_w, thumb_h))
    sheet.paste(overlay, (6 * thumb_w, 0))
    sheet.save(os.path.join(os.path.dirname(__file__), "align_preview.png"))
    print("done ->", OUT_DIR)


if __name__ == "__main__":
    main()
