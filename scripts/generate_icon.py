"""Generate a 1024x1024 source icon for MQ Browser, matching the existing
padding ratio (~8% canvas padding around the rounded-square body)."""

from PIL import Image, ImageDraw, ImageFilter

SIZE = 1024
PAD = int(SIZE * 0.08)
BODY = SIZE - PAD * 2
CORNER = int(BODY * 0.22)

BG = (13, 17, 23, 255)
ACCENT = (45, 212, 191, 255)
ACCENT_DIM = (20, 184, 166, 255)
SHADOW = (0, 0, 0, 180)

canvas = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))

shadow = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
sd = ImageDraw.Draw(shadow)
sd.rounded_rectangle(
    (PAD, PAD + int(SIZE * 0.01), SIZE - PAD, SIZE - PAD + int(SIZE * 0.01)),
    radius=CORNER,
    fill=SHADOW,
)
shadow = shadow.filter(ImageFilter.GaussianBlur(radius=int(SIZE * 0.025)))
canvas = Image.alpha_composite(canvas, shadow)

body = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
bd = ImageDraw.Draw(body)
bd.rounded_rectangle(
    (PAD, PAD, SIZE - PAD, SIZE - PAD),
    radius=CORNER,
    fill=BG,
)
canvas = Image.alpha_composite(canvas, body)

draw = ImageDraw.Draw(canvas)

inner_pad = int(SIZE * 0.20)
left = inner_pad
right = SIZE - inner_pad
top = inner_pad + int(SIZE * 0.02)
bottom = SIZE - inner_pad - int(SIZE * 0.02)

rows = 3
gap = int(SIZE * 0.04)
row_h = (bottom - top - gap * (rows - 1)) // rows

dot_r = row_h // 2 - int(SIZE * 0.005)
dot_cx = left + dot_r
bar_left = dot_cx + dot_r + int(SIZE * 0.035)
bar_right = right
bar_radius = row_h // 2

for i in range(rows):
    y0 = top + i * (row_h + gap)
    y1 = y0 + row_h
    cy = (y0 + y1) // 2
    color = ACCENT if i == 1 else ACCENT_DIM
    draw.ellipse(
        (dot_cx - dot_r, cy - dot_r, dot_cx + dot_r, cy + dot_r),
        fill=color,
    )
    draw.rounded_rectangle(
        (bar_left, y0, bar_right, y1),
        radius=bar_radius,
        fill=color,
    )

out_path = "src-tauri/icons/icon.png"
canvas.save(out_path, "PNG")
print(f"Wrote {out_path} ({SIZE}x{SIZE})")
