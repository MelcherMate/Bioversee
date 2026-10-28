import sys
import os as _os; sys.path.insert(0, _os.path.dirname(_os.path.abspath(__file__)))
from measure import MARK, SMALL, LOGO, inner
import sheet_mark, verify
from verify import render
import os, embedfont
OUT = os.environ.get('BV_OUT', os.path.join(os.path.dirname(os.path.abspath(__file__)), '../../src/assets/blueprint')) + '/'
os.makedirs(OUT, exist_ok=True)
def save(sh, name, bbox):
    svg = embedfont.embed(sh.svg())
    open(OUT + name + '.svg', 'w').write(svg)
    render(sh.svg(), 2.0).save(OUT + name + '.png', optimize=True)
    bad, rep = verify.check(sh, bbox)
    if os.environ.get('BV_CHECKS'): import crops; crops.crops(sh, name, os.environ['BV_CHECKS'] + '/')
    print("==", name, "issues:", bad); print(rep)
    return bad
which = sys.argv[1:] or ['1', '2', '3', '4', '5']
if '1' in which:
    sh, v = sheet_mark.build(MARK, inner(LOGO['LOGO_MARK']), "MARK CONSTRUCTION", "01", 4, "mark", "track 270° · accent 180° (225°→45° cw)")
    save(sh, '01-mark-construction', (0, 0, 64, 64))
if '2' in which:
    sh, v = sheet_mark.build(SMALL, inner(LOGO['LOGO_MARK_SMALL']), "SMALL MARK (FAVICON) CONSTRUCTION", "02", 4, "small", "accent arc 270° (225°→315° cw)")
    save(sh, '02-small-mark-construction', (0, 0, 64, 64))
import sheet_word
from measure import DIAL, SDIAL
WB = (-2, -3, 436, 76)
for n, g, key, t, nm in (('3', DIAL, 'LOGO_WORDMARK', 'WORDMARK', '03-wordmark'), ('4', SDIAL, 'LOGO_WORDMARK_SMALL', 'SMALL WORDMARK (favicon o)', '04-small-wordmark')):
    if n not in which: continue
    sh, v, ink = sheet_word.build(g, inner(LOGO[key]), t, '0' + n, nm)
    sh.titleblock("BIOVERSEE  ·  0%s  %s" % (n, t), "px @ wordmark viewBox (B ink starts x=7; viewBox x=-1)  ·  H = cap height 70.5 px  ·  scale 2.8:1 / detail 5:1 / section 8:1")
    save(sh, nm, WB)
if '5' in which:
    import sheet_clear
    save(sheet_clear.build(), '05-clear-space-min-sizes', WB)
