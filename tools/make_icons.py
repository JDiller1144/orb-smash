"""Erzeugt die App-Icons fuer Orb Smash (Homescreen-Icon fuer iPhone und Manifest).

Aufruf im Projektordner:  python tools/make_icons.py
Braucht Pillow (pip install pillow).
"""
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

S = 1024
OUT = Path(__file__).resolve().parent.parent / "icons"


def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


def make_icon() -> Image.Image:
    img = Image.new("RGBA", (S, S), (0, 0, 0, 255))
    d = ImageDraw.Draw(img)
    for y in range(S):  # Farbverlauf von oben nach unten
        d.line([(0, y), (S, y)], fill=lerp((10, 3, 30), (46, 13, 80), y / (S - 1)) + (255,))

    cx, cy, r = 512, 400, 245  # grosse Kugel

    glow = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    g = ImageDraw.Draw(glow)
    g.ellipse([cx - r - 40, cy - r - 40, cx + r + 40, cy + r + 40], fill=(255, 79, 216, 190))
    g.rectangle([494, 660, 530, 860], fill=(60, 242, 255, 210))
    g.ellipse([400, 820, 624, 900], fill=(60, 242, 255, 120))
    glow = glow.filter(ImageFilter.GaussianBlur(55))
    img = Image.alpha_composite(img, glow)
    d = ImageDraw.Draw(img)

    # Kugel: dunkler Kern, neonpinker Ring, Lichtreflex
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(24, 7, 52, 255))
    inner = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    ImageDraw.Draw(inner).ellipse([cx - r * 0.75, cy - r * 0.85, cx + r * 0.35, cy + r * 0.2], fill=(255, 79, 216, 90))
    inner = inner.filter(ImageFilter.GaussianBlur(40))
    mask = Image.new("L", (S, S), 0)
    ImageDraw.Draw(mask).ellipse([cx - r, cy - r, cx + r, cy + r], fill=255)
    img.paste(Image.alpha_composite(img, inner), (0, 0), mask)
    d = ImageDraw.Draw(img)
    d.ellipse([cx - r, cy - r, cx + r, cy + r], outline=(255, 79, 216, 255), width=40)
    d.arc([cx - r * 0.68, cy - r * 0.68, cx + r * 0.68, cy + r * 0.68], start=200, end=258,
          fill=(255, 255, 255, 150), width=24)

    # Funken an der Trefferstelle
    for x0, y0, x1, y1 in [(512, 645, 512, 600), (512, 645, 470, 610), (512, 645, 554, 610),
                           (512, 645, 440, 640), (512, 645, 584, 640)]:
        d.line([x0, y0, x1, y1], fill=(255, 243, 150, 255), width=12)

    # Schuesse
    for y in (690, 770):
        d.rounded_rectangle([498, y, 526, y + 52], radius=14, fill=(210, 255, 255, 255))

    # Schwebe-Kanone
    d.rounded_rectangle([500, 820, 524, 868], radius=6, fill=(220, 214, 255, 255))
    d.polygon([(412, 905), (612, 905), (578, 862), (446, 862)], fill=(110, 80, 220, 255),
              outline=(60, 242, 255, 255))
    d.line([(412, 905), (612, 905), (578, 862), (446, 862), (412, 905)], fill=(60, 242, 255, 255), width=8)
    d.pieslice([480, 832, 544, 892], 180, 360, fill=(236, 232, 255, 255))
    return img.convert("RGB")


def main():
    OUT.mkdir(exist_ok=True)
    icon = make_icon()
    for name, size in [("icon-512.png", 512), ("icon-192.png", 192), ("apple-touch-icon.png", 180)]:
        icon.resize((size, size), Image.LANCZOS).save(OUT / name, optimize=True)
        print("geschrieben:", OUT / name)


if __name__ == "__main__":
    main()
