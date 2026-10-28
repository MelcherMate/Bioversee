"""Embed subset IBM Plex Mono (OFL) into a sheet SVG so it renders identically everywhere."""
import base64, io, os, re, html
from fontTools import subset
from fontTools.ttLib import TTFont
HERE = os.path.dirname(os.path.abspath(__file__))
FONTS = {400: 'IBMPlexMono-Regular.ttf', 600: 'IBMPlexMono-SemiBold.ttf'}
def _woff2(path, text):
    f = TTFont(path); opt = subset.Options(); opt.flavor = 'woff2'; opt.layout_features = []; opt.drop_tables += ['meta']
    s = subset.Subsetter(opt); s.populate(text=text); s.subset(f)
    b = io.BytesIO(); f.flavor = 'woff2'; f.save(b); return base64.b64encode(b.getvalue()).decode()
def embed(svg):
    text = html.unescape("".join(re.findall(r'<text[^>]*>([^<]*)</text>', svg))) + " 0123456789"
    css = "".join('@font-face{font-family:"BV Blueprint Mono";font-weight:%d;src:url(data:font/woff2;base64,%s) format("woff2")}' % (w, _woff2(os.path.join(HERE, 'fonts', fn), text)) for w, fn in FONTS.items())
    svg = svg.replace('font-family="IBM Plex Mono"', 'font-family="\'BV Blueprint Mono\', \'IBM Plex Mono\', monospace"')
    return re.sub(r'(<svg[^>]*>)', lambda m: m.group(1) + '<defs><style>' + css + '</style></defs>', svg, count=1)
