"""One-off asset maker for the 3D page (not part of npm run build: needs rembg and its model).

- Cuts the plush pets out of their listing photos (data/lookbook/p_<ASIN>.jpg) and gives each a fringed
  tartan scarf, like the board's pets.
- Draws the burlap ribbons at true scale (64 px per inch): weave, hemmed or wired edges, felt paws.
Writes data/cutouts/*.webp, which build_tree.py embeds.
"""
import math, random, pathlib
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT, LB = ROOT / 'data' / 'cutouts', ROOT / 'data' / 'lookbook'
random.seed(11); np.random.seed(11)
PPI = 64

def paw(d, cx, cy, s, fill, rot=0.0):
    for x, y, rx, ry in [(0, .2, .32, .26), (-.36, -.14, .12, .16), (-.13, -.38, .12, .16), (.13, -.38, .12, .16), (.36, -.14, .12, .16)]:
        c, sn = math.cos(rot), math.sin(rot); X = cx + (x * c - y * sn) * s; Y = cy + (x * sn + y * c) * s
        d.ellipse([X - rx * s, Y - ry * s, X + rx * s, Y + ry * s], fill=fill)

def weave(w, h, base=(196, 168, 120), pitch=6):
    """Open-weave jute: warp and weft threads with random tone, darker gaps between them."""
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    tone_x = np.repeat(np.random.uniform(.84, 1.1, w // pitch + 2), pitch)[:w]
    tone_y = np.repeat(np.random.uniform(.84, 1.1, h // pitch + 2), pitch)[:h]
    over = ((xx // pitch + yy // pitch) % 2).astype(np.float32)
    fx = np.abs(((xx % pitch) / pitch) - .5) * 2; fy = np.abs(((yy % pitch) / pitch) - .5) * 2
    thread = np.where(over > 0, tone_x[None, :].repeat(h, 0) * (1 - .35 * fy ** 3), tone_y[:, None].repeat(w, 1) * (1 - .35 * fx ** 3))
    gap = ((fx > .86) & (fy > .86)).astype(np.float32)
    lum = thread * (1 - .55 * gap) * np.random.uniform(.92, 1.06, (h, w))
    rgb = np.clip(np.array(base, np.float32)[None, None, :] * lum[..., None], 0, 255).astype(np.uint8)
    im = Image.fromarray(rgb, 'RGB')
    d = ImageDraw.Draw(im)   # a few slubs (thicker fibres)
    for _ in range(w * h // 4000):
        x, y = random.randrange(w), random.randrange(h); L = random.randint(8, 30); k = random.uniform(.78, 1.12)
        d.line([(x, y), (x + L, y + random.randint(-2, 2))], fill=tuple(int(c * k) for c in base), width=random.randint(1, 2))
    return im

def ribbon(name, width_in, repeat_in, paw_in=0.0, paw_color=(20, 17, 15), paws_per_repeat=2, edge='hem', base=(196, 168, 120)):
    W, H = int(repeat_in * PPI), int(width_in * PPI)
    im = weave(W, H, base)
    if paw_in:
        m = Image.new('L', (W, H), 0); dm = ImageDraw.Draw(m)
        for k in range(paws_per_repeat):
            x = (k + .5) * W / paws_per_repeat; y = H * (.38 if k % 2 == 0 else .62) if width_in > 3 else H / 2
            paw(dm, x, y, paw_in * PPI, 255, rot=random.uniform(-.45, .45))
        m = m.filter(ImageFilter.GaussianBlur(.8))
        felt = Image.fromarray(np.clip(np.array(paw_color, np.float32)[None, None, :] * np.random.uniform(.8, 1.25, (H, W, 1)), 0, 255).astype(np.uint8), 'RGB')
        im = Image.composite(felt, im, m)
    d = ImageDraw.Draw(im); e = max(3, int(.12 * PPI))
    edge_col = tuple(int(c * (.78 if edge == 'hem' else .62)) for c in base)
    d.rectangle([0, 0, W, e], fill=edge_col); d.rectangle([0, H - e, W, H], fill=edge_col)
    if edge == 'hem':
        for x in range(0, W, 9): d.line([(x, e + 2), (x + 5, e + 2)], fill=tuple(int(c * .7) for c in base), width=2); d.line([(x, H - e - 3), (x + 5, H - e - 3)], fill=tuple(int(c * .7) for c in base), width=2)
    im.save(OUT / f'{name}.webp', quality=88); print(name, im.size)

def scarf(src, out, cx, cy, rx, ry, t, tail, size=560):
    """Fringed tartan scarf: a rolled collar round the neck and one tail down the chest."""
    im = Image.open(src).convert('RGBA'); W, H = im.size
    tex = Image.open(OUT / 'tx_scarf.webp').convert('RGB'); T = tex.resize((max(64, int(t * H * 3)), max(128, int(t * H * 6))))
    tile = Image.new('RGB', (W, H))
    for x in range(0, W, T.size[0]):
        for y in range(0, H, T.size[1]): tile.paste(T, (x, y))
    mk = Image.new('L', (W, H), 0); dk = ImageDraw.Draw(mk)
    (sx, sy), (ex, ey), tw = tail
    ang = math.atan2((ey - sy) * H, (ex - sx) * W); nx, ny = -math.sin(ang), math.cos(ang)
    P = lambda x, y: (x * W, y * H)
    a, b = P(sx, sy), P(ex, ey); hw = tw * W / 2
    quad = [(a[0] + nx * hw, a[1] + ny * hw), (b[0] + nx * hw * 1.1, b[1] + ny * hw * 1.1), (b[0] - nx * hw * 1.1, b[1] - ny * hw * 1.1), (a[0] - nx * hw, a[1] - ny * hw)]
    dk.polygon(quad, fill=255)
    for k in range(14):
        f = k / 13; bx = quad[1][0] + (quad[2][0] - quad[1][0]) * f; by = quad[1][1] + (quad[2][1] - quad[1][1]) * f
        L = H * random.uniform(.03, .05); dk.line([(bx, by), (bx + math.cos(ang) * L + random.uniform(-2, 2), by + math.sin(ang) * L)], fill=255, width=max(2, int(W / 120)))
    outer = [(W * (cx + rx * math.cos(q)), H * (cy + ry * math.sin(q) + t / 2)) for q in np.linspace(math.radians(-5), math.radians(185), 60)]
    inner = [(W * (cx + rx * .97 * math.cos(q)), H * (cy + ry * math.sin(q) - t / 2)) for q in np.linspace(math.radians(185), math.radians(-5), 60)]
    dk.polygon(outer + inner, fill=255)
    mk = mk.filter(ImageFilter.GaussianBlur(1))
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    phase = ((yy / H - cy) - ry * np.sqrt(np.clip(1 - ((xx / W - cx) / rx) ** 2, 0, 1))) / (t / 2)
    shade = np.clip(1 - 0.35 * np.clip(np.abs(phase), 0, 1.2) ** 2, .55, 1) * np.clip(1 - 0.4 * np.abs((xx / W - cx) / rx) ** 4, .6, 1)
    rgb = (np.asarray(tile).astype(np.float32) * shade[..., None]).clip(0, 255).astype(np.uint8)
    layer = Image.fromarray(np.dstack([rgb, np.asarray(mk)]), 'RGBA')
    shadow = Image.new('RGBA', (W, H), (0, 0, 0, 0)); shadow.putalpha(mk.filter(ImageFilter.GaussianBlur(6)).point(lambda v: int(v * .45)))
    im.alpha_composite(shadow, (0, int(H * .008))); im.alpha_composite(layer)
    im.thumbnail((size, size), Image.LANCZOS); im.save(OUT / f'{out}.webp', quality=86); print(out, im.size)
    return im

if __name__ == '__main__':
    import sys
    from rembg import remove, new_session
    tmp = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / 'build' / '.cut'; tmp.mkdir(exist_ok=True)
    s = new_session('isnet-general-use')
    for asin, name in (('B0H5YKFT7X', 'cat_fluffy'), ('B00ILYHVDQ', 'golden_aurora')):
        cut = remove(Image.open(LB / f'p_{asin}.jpg').convert('RGB'), session=s); cut = cut.crop(cut.getbbox()); cut.save(tmp / f'{name}.png')
    scarf(tmp / 'cat_fluffy.png', 'cat_fluffy', .33, .41, .21, .05, .06, ((.27, .45), (.23, .66), .1))
    scarf(tmp / 'golden_aurora.png', 'golden_aurora', .5, .46, .33, .08, .08, ((.38, .5), (.33, .74), .12))
    ribbon('tx_burlap6', 6, 10, paw_in=2.2)                    # topper: 6" jute, hemmed, 2.2" black felt paws every 5"
    ribbon('tx_burlap4', 4, 10, paw_in=2.2, edge='wire')       # earlier topper: 4" wired burlap
    ribbon('tx_burlap25', 2.5, 6, paw_in=1.2, paw_color=(98, 66, 40), paws_per_repeat=2, edge='wire')   # printed brown paws
    ribbon('tx_burlap15', 1.5, 6, edge='wire', base=(204, 180, 136))     # cream burlap for the gifts
