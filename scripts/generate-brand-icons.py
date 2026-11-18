from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

OUT = Path("public")
OUT.mkdir(parents=True, exist_ok=True)
GREEN = "#176B5C"
MINT = "#B9D1C8"
WHITE = "#FFFFFF"
FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"

def make_icon(size):
    im = Image.new("RGBA", (size, size), GREEN)
    draw = ImageDraw.Draw(im)
    radius = round(size * 0.22)
    draw.rounded_rectangle(
        (1, 1, size - 2, size - 2),
        radius=radius,
        fill=GREEN,
        outline=MINT,
        width=max(1, round(size * 0.018)),
    )
    font = ImageFont.truetype(FONT, max(8, round(size * 0.49)))
    box24 = draw.textbbox((0, 0), "24", font=font)
    box7 = draw.textbbox((0, 0), "7", font=font)
    width24 = box24[2] - box24[0]
    width7 = box7[2] - box7[0]
    gap = max(0, round(size * 0.005))
    x = (size - width24 - gap - width7) // 2
    y24 = (size - (box24[3] - box24[1])) // 2 - box24[1]
    y7 = (size - (box7[3] - box7[1])) // 2 - box7[1]
    draw.text((x, y24), "24", font=font, fill=WHITE)
    draw.text((x + width24 + gap, y7), "7", font=font, fill=MINT)
    return im

for size, filename in [
    (16, "favicon-16x16.png"),
    (32, "favicon-32x32.png"),
    (48, "favicon-48x48.png"),
    (180, "apple-touch-icon.png"),
    (192, "android-chrome-192x192.png"),
    (512, "android-chrome-512x512.png"),
]:
    make_icon(size).save(OUT / filename, optimize=True)

make_icon(48).save(
    OUT / "favicon.ico",
    format="ICO",
    sizes=[(16, 16), (32, 32), (48, 48)],
)
