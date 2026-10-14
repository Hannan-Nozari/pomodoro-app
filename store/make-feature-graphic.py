from PIL import Image, ImageDraw, ImageFont

S = 4  # supersample factor

def tomato(box):
    """Draw the tomato-clock mark on a transparent RGBA image of size box."""
    n = box * S
    im = Image.new("RGBA", (n, n), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    c, r = n / 2, n * 0.34
    # body
    d.ellipse([c - r, c - r + n*0.03, c + r, c + r + n*0.03], fill="#E05252")
    # soft highlight
    hl = Image.new("RGBA", (n, n), (0, 0, 0, 0))
    ImageDraw.Draw(hl).ellipse([c - r*0.62, c - r*0.72, c - r*0.05, c - r*0.2], fill=(255, 255, 255, 38))
    im.alpha_composite(hl)
    # clock ring (faint) + progress arc
    rr, w = n * 0.225, n * 0.033
    ring = Image.new("RGBA", (n, n), (0, 0, 0, 0))
    dr = ImageDraw.Draw(ring)
    cy = c + n*0.03
    dr.ellipse([c - rr, cy - rr, c + rr, cy + rr], outline=(255, 255, 255, 78), width=int(w))
    im.alpha_composite(ring)
    d.arc([c - rr, cy - rr, c + rr, cy + rr], -90, 0, fill="#FFFFFF", width=int(w))
    # round caps on the arc
    cap = w / 2
    for (x, y) in [(c, cy - rr), (c + rr, cy)]:
        d.ellipse([x - cap, y - cap, x + cap, y + cap], fill="#FFFFFF")
    # hands
    hw = n * 0.016
    d.rounded_rectangle([c - hw, cy - rr*0.72, c + hw, cy + n*0.012], radius=hw, fill="#FFFFFF")
    d.rounded_rectangle([c - hw, cy - hw, c + rr*0.66, cy + hw], radius=hw, fill="#FFFFFF")
    d.ellipse([c - n*0.027, cy - n*0.027, c + n*0.027, cy + n*0.027], fill="#FFFFFF")
    # leaves
    ly = cy - r - n*0.005
    d.polygon([(c, ly + n*0.025), (c - n*0.10, ly - n*0.012), (c - n*0.16, ly + n*0.004),
               (c - n*0.055, ly + n*0.042)], fill="#4CAF50")
    d.polygon([(c, ly + n*0.025), (c + n*0.10, ly - n*0.012), (c + n*0.16, ly + n*0.004),
               (c + n*0.055, ly + n*0.042)], fill="#43A047")
    d.polygon([(c, ly + n*0.032), (c - n*0.020, ly - n*0.030), (c + n*0.012, ly - n*0.082),
               (c + n*0.024, ly - n*0.018)], fill="#5BBA5F")
    return im.resize((box, box), Image.LANCZOS)

W, H = 1024, 500
img = Image.new("RGB", (W, H), "#FFFFFF")
d = ImageDraw.Draw(img)
top, bot = (255, 255, 255), (253, 232, 232)
for y in range(H):
    t = y / (H - 1)
    d.line([(0, y), (W, y)], fill=tuple(int(top[i] + (bot[i] - top[i]) * t) for i in range(3)))

mark = tomato(360)
img.paste(mark, (108, (H - 360) // 2), mark)

bold = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial Bold.ttf", 84)
reg = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial.ttf", 29)
x = 512
d.text((x, 190), "Pomodoro", font=bold, fill="#E05252")
tag = "stay focused · one session at a time"
d.text((x + 4, 296), tag, font=reg, fill="#6B7280")
right = d.textbbox((x + 4, 296), tag, font=reg)[2]
print("tagline right edge:", right, "of", W)
img.save("/Users/hannannozari/pomodoro-app/store/feature-graphic.png")
print("written", img.size)
