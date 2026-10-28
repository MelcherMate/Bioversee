import math, re, io
import numpy as np, cairosvg
from PIL import Image
FONT = "IBM Plex Mono"; FS = 11.0; CW = 0.6 * FS
C = dict(bg="#0b2f52", minor="#ffffff", dim="#ffc857", aux="#7fd1c7", text="#ffffff", muted="#9fb3c8",
         ink="#ffffff", accent="#2bb3a6")
HAIR = 0.75; GAP = 3.0; OVER = 5.0; AL = 7.0; AW = 2.2
def f(v): return ("%.3f" % v).rstrip('0').rstrip('.')
def num(v, nd=2): return ("%.*f" % (nd, v)).rstrip('0').rstrip('.')
def colorize(s, mask=False):
    if mask:
        s = s.replace("stroke-opacity:var(--bv-logo-track, 0.2)", "stroke-opacity:1")
        return s.replace("var(--bv-text)", "#000").replace("var(--bv-accent)", "#000")
    return s.replace("var(--bv-logo-track, 0.2)", "0.22").replace("var(--bv-text)", C['ink']).replace("var(--bv-accent)", C['accent'])

class View:
    def __init__(self, sheet, S, ox, oy, logo_inner, clip=None, name="view"):
        self.sh, self.S, self.ox, self.oy, self.logo, self.clip, self.name = sheet, S, ox, oy, logo_inner, clip, name
        sheet.views.append(self)
    def X(self, x): return self.ox + self.S * x
    def Y(self, y): return self.oy + self.S * y
    def logo_svg(self, mask=False):
        cid = "clip_%s" % self.name
        g = '<g transform="translate(%s %s) scale(%s)"' % (f(self.ox), f(self.oy), f(self.S))
        pre = ""
        if self.clip:
            x, y, w, h = self.clip
            pre = '<clipPath id="%s"><rect x="%s" y="%s" width="%s" height="%s"/></clipPath>' % (cid, f(x), f(y), f(w), f(h))
            g += ' clip-path="url(#%s)"' % cid
        return pre + g + '>' + colorize(self.logo, mask) + '</g>'

class Sheet:
    def __init__(self, W, H):
        self.W, self.H = W, H
        self.views = []; self.L = dict(grid=[], cons=[], dims=[], labels=[], frame=[])
        self.labels = []; self.probes = []
    def add(self, layer, s): self.L[layer].append(s)
    def line(self, layer, x1, y1, x2, y2, color=None, w=HAIR, dash=None, op=1):
        d = ' stroke-dasharray="%s"' % dash if dash else ''
        o = ' stroke-opacity="%s"' % op if op != 1 else ''
        self.add(layer, '<line x1="%s" y1="%s" x2="%s" y2="%s" stroke="%s" stroke-width="%s"%s%s/>' % (f(x1), f(y1), f(x2), f(y2), color or C['dim'], f(w), d, o))
    def arrow(self, tx, ty, dx, dy, color=None, layer='dims'):
        n = math.hypot(dx, dy); ux, uy = dx / n, dy / n
        bx, by = tx - ux * AL, ty - uy * AL
        p = [(tx, ty), (bx - uy * AW, by + ux * AW), (bx + uy * AW, by - ux * AW)]
        self.add(layer, '<path d="M%s %sL%s %sL%s %sZ" fill="%s"/>' % (f(p[0][0]), f(p[0][1]), f(p[1][0]), f(p[1][1]), f(p[2][0]), f(p[2][1]), color or C['dim']))
    def text(self, x, y, s, anchor="start", size=FS, color=None, weight=400, layer='labels', check=True):
        w = len(s) * 0.6 * size
        x0 = x if anchor == "start" else (x - w / 2 if anchor == "middle" else x - w)
        esc = s.replace('&', '&amp;').replace('<', '&lt;')
        self.add(layer, '<text x="%s" y="%s" font-family="%s" font-size="%s" font-weight="%s" fill="%s" text-anchor="%s">%s</text>' % (f(x), f(y), FONT, f(size), weight, color or C['dim'], anchor, esc))
        if check: self.labels.append((s, (x0, y - 0.74 * size, x0 + w, y + 0.2 * size)))
    # dimensions: values in logo units of view v
    def hdim(self, v, x1, x2, yf1, yf2, yat, label, probes=(None, None), lab="above", ext=(True, True), side="right"):
        X1, X2, YA = v.X(x1), v.X(x2), v.Y(yat)
        for X, yf, e in ((X1, yf1, ext[0]), (X2, yf2, ext[1])):
            if not e: continue
            Yf = v.Y(yf); sgn = 1 if YA > Yf else -1
            self.line('dims', X, Yf + sgn * GAP, X, YA + sgn * OVER)
        span = X2 - X1; tw = len(label) * CW
        inside = span >= 2 * AL + 6
        if inside:
            self.line('dims', X1, YA, X2, YA); self.arrow(X1, YA, -1, 0); self.arrow(X2, YA, 1, 0)
        else:
            self.line('dims', X1 - AL - 9, YA, X2 + AL + 9, YA); self.arrow(X1, YA, 1, 0); self.arrow(X2, YA, -1, 0)
        ty = YA - 4 if lab == "above" else YA + 4 + 0.74 * FS
        if inside and tw + 8 <= span: self.text((X1 + X2) / 2, ty, label, "middle")
        elif side == "right": self.text(X2 + AL + 13, YA + 0.37 * FS, label, "start")
        else: self.text(X1 - AL - 13, YA + 0.37 * FS, label, "end")
        for val, pr in zip((x1, x2), probes): self.probes.append(dict(view=v, axis='x', val=val, probe=pr, label=label))
    def vdim(self, v, y1, y2, xf1, xf2, xat, label, probes=(None, None), lab="right", ext=(True, True), lab_dy=0):
        Y1, Y2, XA = v.Y(y1), v.Y(y2), v.X(xat)
        for Y, xf, e in ((Y1, xf1, ext[0]), (Y2, xf2, ext[1])):
            if not e: continue
            Xf = v.X(xf); sgn = 1 if XA > Xf else -1
            self.line('dims', Xf + sgn * GAP, Y, XA + sgn * OVER, Y)
        span = Y2 - Y1
        inside = span >= 2 * AL + 4
        if inside:
            self.line('dims', XA, Y1, XA, Y2); self.arrow(XA, Y1, 0, -1); self.arrow(XA, Y2, 0, 1)
        else:
            self.line('dims', XA, Y1 - AL - 8, XA, Y2 + AL + 8); self.arrow(XA, Y1, 0, 1); self.arrow(XA, Y2, 0, -1)
        ty = (Y1 + Y2) / 2 + 0.37 * FS + lab_dy
        if lab == "right": self.text(XA + 6, ty, label, "start")
        else: self.text(XA - 6, ty, label, "end")
        for val, pr in zip((y1, y2), probes): self.probes.append(dict(view=v, axis='y', val=val, probe=pr, label=label))
    def ordinate(self, v, y, xf, xat, label, probe=None, lab="left"):
        """ordinate tick: ext line from xf to xat at height y, label at end."""
        Y = v.Y(y); Xf = v.X(xf); XA = v.X(xat); sgn = 1 if XA > Xf else -1
        self.line('dims', Xf + sgn * GAP, Y, XA, Y)
        self.line('dims', XA, Y - 3, XA, Y + 3)
        if lab == "left": self.text(XA - 5, Y + 0.37 * FS, label, "end")
        else: self.text(XA + 5, Y + 0.37 * FS, label, "start")
        self.probes.append(dict(view=v, axis='y', val=y, probe=probe, label=label))
    def cline(self, v, x1, y1, x2, y2, dash="9 3 1.5 3", op=0.9):
        self.line('cons', v.X(x1), v.Y(y1), v.X(x2), v.Y(y2), C['aux'], HAIR, dash, op)
    def ccircle(self, v, cx, cy, r, dash="4 3", op=0.75):
        self.add('cons', '<circle cx="%s" cy="%s" r="%s" fill="none" stroke="%s" stroke-width="%s" stroke-dasharray="%s" stroke-opacity="%s"/>' % (f(v.X(cx)), f(v.Y(cy)), f(r * v.S), C['aux'], HAIR, dash, op))
    def grid(self, v, x0, y0, x1, y1, step, major=None):
        n = int(round((x1 - x0) / step))
        for i in range(n + 1):
            x = x0 + i * step; M = major and i % major == 0
            self.line('grid', v.X(x), v.Y(y0), v.X(x), v.Y(y1), C['minor'], 0.5, None, 0.16 if M else 0.07)
        n = int(round((y1 - y0) / step))
        for i in range(n + 1):
            y = y0 + i * step; M = major and i % major == 0
            self.line('grid', v.X(x0), v.Y(y), v.X(x1), v.Y(y), C['minor'], 0.5, None, 0.16 if M else 0.07)
    def svg(self, layers=("grid", "cons", "logo", "dims", "labels", "frame"), mask=False, bg=True):
        out = ['<svg xmlns="http://www.w3.org/2000/svg" width="%d" height="%d" viewBox="0 0 %d %d">' % (self.W, self.H, self.W, self.H)]
        if bg: out.append('<rect width="100%%" height="100%%" fill="%s"/>' % C['bg'])
        for L in layers:
            if L == "logo": out += [v.logo_svg(mask) for v in self.views]
            else: out += self.L[L]
        out.append('</svg>'); return "\n".join(out)
    def titleblock(self, left, right):
        y = self.H - 44
        self.line('frame', 24, y, self.W - 24, y, C['muted'], HAIR, None, 0.6)
        self.text(24, y + 26, left, "start", 13, C['text'], 600, 'frame', check=False)
        self.text(self.W - 24, y + 26, right, "end", FS, C['muted'], 400, 'frame', check=False)

def colorize(s, mask=False):
    if mask == 'acc':
        s = s.replace("stroke-opacity:var(--bv-logo-track, 0.2)", "stroke-opacity:0")
        return s.replace("var(--bv-text)", "rgba(0,0,0,0)").replace("var(--bv-accent)", "#000")
    if mask:
        s = s.replace("stroke-opacity:var(--bv-logo-track, 0.2)", "stroke-opacity:1")
        return s.replace("var(--bv-text)", "#000").replace("var(--bv-accent)", "#000")
    return s.replace("var(--bv-logo-track, 0.2)", "0.22").replace("var(--bv-text)", C['ink']).replace("var(--bv-accent)", C['accent'])
