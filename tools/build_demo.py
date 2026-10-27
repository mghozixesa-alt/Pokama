"""Bangun situs pokama.org (folder demo/) dari file rancangan di design/. Jalankan: python3 tools/build_demo.py"""
import re, json, glob, html, os, shutil
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
P = os.path.join(ROOT, 'design') + '/'
O = os.path.join(ROOT, 'demo') + '/'
c = json.load(open(P + 'canvas.json'))
titles = {k: v['title'] for k, v in c['boards'].items()}
for old in glob.glob(O + '*.dc.html'):
    os.remove(old)
HP_CSS = '''<style>
body{margin:0;background:#E9ECF0;display:flex;justify-content:center;align-items:flex-start;min-height:100vh}
#root>div{width:min(390px,100vw)!important;height:min(844px,100dvh)!important}
@media(min-width:500px){body{padding:24px 0}#root>div{border-radius:28px;box-shadow:0 20px 60px rgba(29,49,73,.25)}}
</style>'''
for f in sorted(glob.glob(P + '*.dc.html')):
    n = os.path.basename(f)
    if n not in titles:
        continue
    if n in ('Masuk.dc.html', 'Keputusan.dc.html'):
        continue  # halaman rancangan, bukan bagian aplikasi
    s = open(f).read()
    xdc = re.search(r'<x-dc>([\s\S]*)</x-dc>', s).group(1)
    hel = re.search(r'<helmet>([\s\S]*?)</helmet>', xdc)
    helc = hel.group(1) if hel else ''
    tplc = xdc.replace(hel.group(0), '') if hel else xdc
    tplc = re.sub(r'/_blob/[0-9a-f]+', 'rentalaja-logo.png', tplc)
    scr = re.search(r'data-dc-script[^>]*>([\s\S]*?)</script>', s).group(1)
    scr = scr.replace("href: 'Masuk.dc.html'", "href: 'index.html'")
    tplc = tplc.replace('href="Masuk.dc.html"', 'href="index.html"')
    # Demo publik: foto tim tidak ikut (privasi), tampil inisial
    scr = re.sub(r'const PH = \{.*?\}; const AL', 'const PH = {}; const AL', scr)
    tplc = re.sub(r'(<span aria-label="Wiranata[^>]*>)<img src="data:image/jpeg[^"]*"[^>]*></span>', r'\1WR</span>', tplc)
    tplc = re.sub(r'(<span aria-hidden="true" style="width: 48px[^>]*>)<img src="data:image/jpeg[^"]*"[^>]*></span>', r'\1WR</span>', tplc)
    title = re.search(r'<title>(.*?)</title>', s).group(1)
    extra = HP_CSS if n.endswith('Hp.dc.html') else ''
    out = f'''<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title}</title>
<meta name="robots" content="noindex">
{helc.strip()}
{extra}
<script src="runtime.js"></script>
</head>
<body>
<div id="root"></div>
<script type="text/plain" id="dc-tpl">{tplc}</script>
<script>
{scr}
dcBoot(Component);
</script>
</body>
</html>
'''
    open(O + n, 'w').write(out)
shutil.copy(os.path.join(ROOT, 'tools', 'login.html'), O + 'index.html')
for old in ('rentalaja-logo.png',):
    if os.path.exists(O + old):
        os.remove(O + old)
print('built', len(glob.glob(O + '*.dc.html')), 'pages')
