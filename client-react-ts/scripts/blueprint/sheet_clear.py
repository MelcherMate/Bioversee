from lib import Sheet, View, C, f, num, FS, HAIR
from sheet_mark import pmin, pmax
from measure import MARK, SMALL, LOGO, inner, GLY, gbox

def zone(sh, v, ink, x):
    X0, Y0 = v.X(ink[0] - x), v.Y(ink[1] - x)
    W, H = (ink[2] - ink[0] + 2 * x) * v.S, (ink[3] - ink[1] + 2 * x) * v.S
    sh.add('cons', '<rect x="%s" y="%s" width="%s" height="%s" fill="%s" fill-opacity="0.12" stroke="%s" stroke-width="%s" stroke-dasharray="5 4"/>' % (f(X0), f(Y0), f(W), f(H), C['aux'], C['aux'], HAIR))
    sh.add('cons', '<rect x="%s" y="%s" width="%s" height="%s" fill="%s" stroke="%s" stroke-width="%s" stroke-dasharray="2 3" stroke-opacity="0.7"/>' % (
        f(v.X(ink[0])), f(v.Y(ink[1])), f((ink[2] - ink[0]) * v.S), f((ink[3] - ink[1]) * v.S), C['bg'], C['muted'], HAIR))

def build():
    sh = Sheet(1600, 880)
    wink = [gbox('B')[0], gbox('i')[1], max(gbox(k)[2] for k in GLY), max(gbox(k)[3] for k in GLY)]
    # --- mark clear space: x = R/2 ---
    g = MARK; ink = g['ink']; x = g['R'] / 2; S = 5.5
    v = View(sh, S, 110 - S * (ink[0] - x), 120 - S * (ink[1] - x), inner(LOGO['LOGO_MARK']), name="cm")
    zone(sh, v, ink, x)
    sh.hdim(v, ink[0] - x, ink[0], ink[1] - x, ink[1], ink[1] - x - 5, "x = %s" % num(x), side="left",
            ext=(False, True), probes=(None, pmin('x', ink[0], g['cy'])))
    sh.vdim(v, ink[1] - x, ink[1], ink[0] - x, ink[0], ink[0] - x - 5, "x", lab="left", ext=(False, True),
            probes=(None, pmin('y', ink[1], g['cx'])))
    sh.text(v.X(ink[0] - x), v.Y(ink[3] + x) + 24, "MARK  ·  x = ½ R = %s px (%s m)" % (num(x), num(x / 4)), "start", FS, C['text'])
    # --- wordmark clear space: x = cap height ---
    Hc = 70.5; S2 = 1.45
    v2 = View(sh, S2, 640 - S2 * (wink[0] - Hc), 120 - S2 * (wink[1] - Hc), inner(LOGO['LOGO_WORDMARK']), name="cw")
    zone(sh, v2, wink, Hc)
    sh.hdim(v2, wink[0] - Hc, wink[0], wink[1] - Hc, wink[1], wink[1] - Hc - 12, "x = %s" % num(Hc), side="left",
            ext=(False, True), probes=(None, pmin('x', wink[0], 35)))
    sh.vdim(v2, wink[1] - Hc, wink[1], wink[0] - Hc, wink[0], wink[0] - Hc - 12, "x", lab="left", ext=(False, True),
            probes=(None, pmin('y', wink[1], 74.8)))
    sh.text(v2.X(wink[0] - Hc), v2.Y(wink[3] + Hc) + 24, "WORDMARK  ·  x = H (cap height) = %s px" % num(Hc), "start", FS, C['text'])
    # --- minimum sizes at 1:1 ---
    yb = 680
    sh.line('frame', 24, yb - 40, sh.W - 24, yb - 40, C['muted'], HAIR, None, 0.35)
    sh.text(24, yb - 52 + 30, "MINIMUM SIZES  ·  shown at 1:1 (sheet px)", "start", 13, C['text'], 600, 'labels')
    items = [("LOGO_MARK", "mark", 32 / 64, (0, 0, 64, 64), "Mark ≥ 32 px", MARK['ink']),
             ("LOGO_MARK_SMALL", "small", 16 / 64, (0, 0, 64, 64), "Small mark 16–31 px", SMALL['ink']),
             ("LOGO_WORDMARK", "word", 160 / (wink[2] - wink[0]), None, "Wordmark ≥ 160 px ink width", wink),
             ("LOGO_WORDMARK_SMALL", "sword", 96 / (wink[2] - wink[0]), None, "Small wordmark 96–159 px", wink)]
    xs = [80, 300, 560, 960]
    for (key, nm, k, art, lab, ik), x0 in zip(items, xs):
        vv = View(sh, k, x0 - k * (art[0] if art else ik[0]), yb + 30 - k * (art[1] if art else ik[1]), inner(LOGO[key]), name="min_" + nm)
        if art:
            sh.add('cons', '<rect x="%s" y="%s" width="%s" height="%s" fill="none" stroke="%s" stroke-width="%s" stroke-dasharray="2 2" stroke-opacity="0.6"/>' % (f(vv.X(0)), f(vv.Y(0)), f(64 * k), f(64 * k), C['muted'], HAIR))
            sh.hdim(vv, 0, 64, 64, 64, 64 + 14 / k, "%s px" % num(64 * k), lab="below", probes=(None, None))
        else:
            sh.hdim(vv, ik[0], ik[2], ik[3] + 3 / k, ik[3] + 3 / k, ik[3] + 14 / k, "%s px" % num((ik[2] - ik[0]) * k), lab="below",
                    probes=(pmin('x', ik[0], 35), pmax('x', ik[2], 45.2)))
        sh.text(x0, yb + 10, lab, "start", FS, C['text'])
    sh.titleblock("BIOVERSEE  ·  05  CLEAR SPACE & MINIMUM SIZES", "clear space measured from ink bounds, not the viewBox  ·  minimum sizes = proposal, confirm")
    return sh
