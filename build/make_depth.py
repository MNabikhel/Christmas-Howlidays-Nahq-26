"""Offline helper: monocular depth maps for the photo cutouts the 3D tree inflates into reliefs.

Run it only when a cutout in data/cutouts/ changes:
    pip install onnxruntime        # not needed by `npm run build`
    python3 build/make_depth.py --model path/to/da2s_q.onnx [names...]

It writes data/depth/<cutout>.png (128 px wide, 8-bit grey, 0 = outline/far, 255 = nearest), which are
committed. build/build_tree.py embeds them next to the cutouts, and build/tree.js uses them to shape the
front of each plush relief (muzzle, nose and paws stand out). `npm run build` never needs onnxruntime or
the model.

Model: Depth Anything V2 Small (Yang et al., 2024), Apache-2.0 licence, an int8-quantised ONNX export
(about 27 MB). The model is not committed; keep it in a cache folder and pass --model.

It also cleans the knit stocking cutouts: the product photo carries a staged greenery sprig behind the cuff
as semi-transparent pixels, which a relief would inflate into a ghost blob. The sprig is not part of the
12-pack, so clean_cutout() removes it and writes data/depth/<stock>.clean.webp plus data/depth/cuffs.json
(where the white cuff is, for the felt paw tree.js draws on it). build_tree.py embeds the clean copy in place
of data/cutouts/<stock>.webp (which is left as it is), so the build needs neither numpy nor onnxruntime.
"""
import argparse, io, json, pathlib, sys
import numpy as np
from PIL import Image, ImageFilter, ImageDraw

ROOT = pathlib.Path(__file__).resolve().parent.parent
# the cutouts the tree inflates as plush/fabric reliefs (pine_pick is a flat pick: no depth map)
TREE_CUTS = ['golden_tree', 'golden_aurora', 'golden_scarf', 'cat_miyoni', 'cat_fluffy', 'tabby_mini_s', 'tabby_cat_s',
             'stock_red', 'stock_green', 'stock_cream', 'small_bone', 'rope_cane', 'rope_knot']
STOCKINGS = ('stock_red', 'stock_green', 'stock_cream')


def clean_cutout(name, im):
    """Return the cutout to embed. Stockings: drop faint fringe (alpha < 40); above the knit body keep only the
    solid white pixels connected to the cuff's bottom edge (the loop and the cuff), opened by 2 px so the
    sprig's thin stems do not stay attached. Everything else is returned unchanged."""
    if name not in STOCKINGS:
        return im
    im = im.convert('RGBA'); a = np.asarray(im).copy(); H, W = a.shape[:2]
    al = a[..., 3]; rgb = a[..., :3].astype(float)
    al[al < 40] = 0
    mx, mn = rgb.max(-1), rgb.min(-1); sat = (mx - mn) / (mx + 1)
    rows = [y for y in range(H) if (al[y] > 185).sum() > 20 and sat[y][al[y] > 185].mean() > 0.3]
    top = rows[0] if rows and rows[0] < H * 0.7 else int(H * 0.45)   # first knit-colour row: the body starts here
    # above the body only the white hanging loop and the white knit cuff belong to the product
    solid = (al > 185).copy(); solid[:top] &= (sat[:top] < 0.13) & (mx[:top] > 150)
    opened = Image.fromarray((solid * 255).astype(np.uint8)).filter(ImageFilter.MinFilter(5)).filter(ImageFilter.MaxFilter(5))
    op = np.asarray(opened) > 0
    # the white cuff's bottom edge, just above the body: flood the white loop+cuff from there
    seed = None
    for y in range(top - 3, max(0, top - 40), -1):
        xs = np.nonzero(op[y])[0]
        if len(xs) > 8: seed = (int(xs[len(xs) // 2]), y); break
    keep = np.ones((H, W), bool); keep[:top] = False
    if seed:
        comp = Image.fromarray((op[:top] * 255).astype(np.uint8)).copy(); ImageDraw.floodfill(comp, seed, 128)
        cuff = Image.fromarray(((np.array(comp) == 128) * 255).astype(np.uint8))
        cuff = np.asarray(cuff.filter(ImageFilter.MaxFilter(5))) > 0   # give back the 2 px edge
        keep[:top] = cuff & (sat[:top] < 0.2)
        # where the sprig's purple leaves sit in front of the cuff, the cuff pixels are tinted: take them back
        # inside the cuff band (rows that already hold white cuff) up to the body's right edge, and whiten them
        body_x = np.nonzero(al[min(H - 1, top + 3)] > 185)[0]
        if len(body_x):
            right = body_x.max() + int(0.2 * W); wid = keep[:top].sum(1); band = wid > 0.35 * wid.max()
            ys = np.nonzero(wid > 0.6 * wid.max())[0]; y0 = ys.min() if len(ys) else top   # the cuff's top row
            # above the cuff only the white hanging loop belongs: a thin bright ring, not the sprig's leaves
            loop = keep[:y0] & (sat[:y0] < 0.07) & (mx[:y0] > 185)
            loop = np.asarray(Image.fromarray((loop * 255).astype(np.uint8)).filter(ImageFilter.MinFilter(3)).filter(ImageFilter.MaxFilter(5))) > 0
            keep[:y0] &= loop
            region = np.zeros((H, W), bool); region[y0:top, :right] = True
            left = np.full(H, W); lx = [np.nonzero(keep[y])[0] for y in range(H)]
            for y in range(y0, top):
                if len(lx[y]): region[y, :lx[y].min()] = False
            tinted = region & (al > 170) & ~(keep & (al > 235))
            lum = rgb[tinted].mean(1); cuffc = np.median(rgb[y0:top][keep[y0:top]], 0)
            k = 0.86 + 0.14 * (lum - lum.min()) / (np.ptp(lum) + 1)   # keep a little of the knit texture
            a[tinted, :3] = np.clip(cuffc[None] * k[:, None], 0, 255).astype(np.uint8)
            keep |= tinted; al[tinted] = 255
    # sprig tint over the top of the knit body: pull the purple back to the body colour
    purple = (rgb[..., 2] > rgb[..., 1] + 25) & (rgb[..., 0] > rgb[..., 1] + 10) & keep
    purple[:top] = False
    if purple.any():
        bodyc = np.median(rgb[top + 10:][al[top + 10:] > 200], 0)
        lum = rgb[purple].mean(1, keepdims=True) / (bodyc.mean() + 1)
        a[purple, :3] = np.clip(bodyc[None] * lum, 0, 255).astype(np.uint8)
    al[~keep] = 0
    band = al[top:top + int(H * 0.12)]; band[band < 200] = 0   # the sprig's see-through fringe over the top of the body
    # drop leftover sprig fragments: any solid piece (after a 1 px erosion) smaller than 2% of the stocking
    lab = Image.fromarray(((al > 120) * 255).astype(np.uint8)).filter(ImageFilter.MinFilter(3)).copy(); total = (al > 0).sum(); v = 1
    while True:
        ys, xs = np.nonzero(np.array(lab) == 255)
        if not len(ys): break
        ImageDraw.floodfill(lab, (int(xs[0]), int(ys[0])), v); m = np.array(lab) == v
        if m.sum() < 0.02 * total: al[np.asarray(Image.fromarray((m * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(7))) > 0] = 0
        v += 1
        if v > 250: break
    al[np.asarray(Image.fromarray(((al > 120) * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(5))) == 0] = 0   # faint haze off the solid pieces
    a[..., 3] = al
    out = Image.fromarray(a, 'RGBA')
    try:   # where the white cuff is (fractions of the image), for the felt paw tree.js draws on it
        band = (al[:top] > 200) & (sat[:top] < 0.2); rows = np.nonzero(band.sum(1) > 0.6 * band.sum(1).max())[0]
        ys, xs = np.nonzero(band[rows.min():rows.max() + 1])
        out.info['cuff'] = [round(float(np.median(xs)) / W, 3), round((rows.min() + rows.max()) / 2 / H, 3), round((rows.max() - rows.min()) / H, 3)]
    except ValueError:
        pass
    return out


def depth_png(sess, im, W=128):
    a = np.asarray(im)[..., 3] / 255.
    bg = Image.new('RGBA', im.size, (128, 128, 128, 255)); bg.alpha_composite(im)
    rgb = bg.convert('RGB').resize((518, 518), Image.BICUBIC)
    x = (np.asarray(rgb) / 255. - [0.485, 0.456, 0.406]) / [0.229, 0.224, 0.225]
    x = x.transpose(2, 0, 1)[None].astype(np.float32)
    name = sess.get_inputs()[0].name
    d = sess.run(None, {name: x})[0][0]
    H = max(8, round(W * im.size[1] / im.size[0]))
    d = np.asarray(Image.fromarray(d.astype(np.float32)).resize((W, H), Image.BILINEAR))
    m = np.asarray(Image.fromarray((a * 255).astype(np.uint8)).resize((W, H), Image.BILINEAR)) > 100
    v = d[m]; lo, hi = np.percentile(v, 2), np.percentile(v, 99.5)
    d = np.clip((d - lo) / (hi - lo + 1e-6), 0, 1); d[~m] = 0
    out = Image.fromarray((d * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.8))
    b = io.BytesIO(); out.save(b, 'PNG', optimize=True); return b.getvalue()


def main():
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('--model', required=True, help='Depth Anything V2 Small ONNX file (da2s_q.onnx)')
    ap.add_argument('--width', type=int, default=128)
    ap.add_argument('names', nargs='*', help='cutout names (default: every cutout the tree inflates)')
    args = ap.parse_args()
    import onnxruntime as ort   # only this offline helper needs it
    sess = ort.InferenceSession(args.model, providers=['CPUExecutionProvider'])
    out = ROOT / 'data' / 'depth'; out.mkdir(exist_ok=True)
    cuffs_f = out / 'cuffs.json'; cuffs = json.loads(cuffs_f.read_text()) if cuffs_f.exists() else {}
    for n in args.names or TREE_CUTS:
        f = ROOT / 'data' / 'cutouts' / f'{n}.webp'
        if not f.exists(): print('skip (no cutout)', n); continue
        im = clean_cutout(n, Image.open(f).convert('RGBA'))
        if n in STOCKINGS:
            im.save(out / f'{n}.clean.webp', 'WEBP', quality=90, method=6)
            if im.info.get('cuff'): cuffs[n] = [float(x) for x in im.info['cuff']]
        png = depth_png(sess, im, args.width)
        (out / f'{n}.png').write_bytes(png); print(n, len(png), 'bytes')
    cuffs_f.write_text(json.dumps(cuffs, indent=1))


if __name__ == '__main__':
    sys.exit(main())
