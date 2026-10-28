import io, os, re, cairosvg
from PIL import Image, ImageDraw
def crops(sh, name, out):
    os.makedirs(out, exist_ok=True)
    full = sh.svg(); tiles = []
    for p in sh.probes:
        if p['probe'] is None: continue
        v = p['view']; w = p['probe'][2]
        if p['axis'] == 'x': cx, cy = v.X(p['val']), v.Y((w[1] + w[3]) / 2)
        else: cx, cy = v.X((w[0] + w[2]) / 2), v.Y(p['val'])
        r = 14
        s = re.sub(r'viewBox="[^"]+"', 'viewBox="%f %f %f %f"' % (cx - r, cy - r, 2 * r, 2 * r), full, count=1)
        s = re.sub(r'width="\d+" height="\d+"', 'width="336" height="336"', s, count=1)
        s = s.replace("<rect width=\"100%\" height=\"100%\"", "<rect x=\"-9999\" y=\"-9999\" width=\"30000\" height=\"30000\"", 1)
        im = Image.open(io.BytesIO(cairosvg.svg2png(bytestring=s.encode()))).convert("RGB")
        d = ImageDraw.Draw(im)
        if p['axis'] == 'x': d.line([(168, 0), (168, 335)], fill=(255, 60, 60), width=1)
        else: d.line([(0, 168), (335, 168)], fill=(255, 60, 60), width=1)
        d.rectangle([0, 0, 335, 18], fill=(0, 0, 0)); d.text((4, 3), "%s %s=%.2f" % (p['label'][:26], p['axis'], p['val']), fill=(255, 255, 255))
        tiles.append(im)
    cols = 6; rows = (len(tiles) + cols - 1) // cols
    M = Image.new("RGB", (cols * 340, rows * 340), (40, 40, 40))
    for i, t in enumerate(tiles): M.paste(t, ((i % cols) * 340, (i // cols) * 340))
    M.save(out + name + '-zoomcheck.png'); return len(tiles)
