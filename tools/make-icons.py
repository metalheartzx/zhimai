# 生成 PWA 图标（青绿底 + 白色知识节点图形）
from PIL import Image, ImageDraw
import os

OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "assets", "icons")
os.makedirs(OUT, exist_ok=True)
BG = (15, 110, 98, 255)
WHITE = (255, 255, 255, 255)


def draw_icon(size, maskable=False):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    scale = size / 512.0
    pad = 0 if maskable else int(38 * scale)
    radius = 0 if maskable else int(112 * scale)
    box = [pad, pad, size - pad, size - pad]
    if radius:
        d.rounded_rectangle(box, radius=radius, fill=BG)
    else:
        d.rectangle(box, fill=BG)
    ink = WHITE
    # 三个节点 + 连线（先修关系图）
    lw = max(2, int(12 * scale))
    n = lambda x, y, r: d.ellipse([x - r, y - r, x + r, y + r], fill=ink)
    if maskable:
        k = 0.86
        ox = (size - size * k) / 2
        oy = (size - size * k) / 2
        s = size * k
    else:
        ox, oy, s = 0, 0, size
    cx = lambda v: ox + v * s
    cy = lambda v: oy + v * s
    p1 = (cx(0.30), cy(0.70))
    p2 = (cx(0.70), cy(0.70))
    p3 = (cx(0.50), cy(0.30))
    d.line([p1, p3], fill=ink, width=lw)
    d.line([p2, p3], fill=ink, width=lw)
    n(p1[0], p1[1], int(52 * scale))
    n(p2[0], p2[1], int(52 * scale))
    r3 = int(66 * scale)
    n(p3[0], p3[1], r3)
    d.ellipse([p3[0] - r3 * 0.45, p3[1] - r3 * 0.45, p3[0] + r3 * 0.45, p3[1] + r3 * 0.45], fill=BG)
    return img


for size, name in ((192, "icon-192.png"), (512, "icon-512.png"), (180, "apple-touch-icon.png")):
    draw_icon(size).save(os.path.join(OUT, name))
draw_icon(512, maskable=True).save(os.path.join(OUT, "icon-maskable-512.png"))
print("icons written to", OUT)
