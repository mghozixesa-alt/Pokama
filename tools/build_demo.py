"""Bangun demo/ dari file rancangan di design/. Jalankan: python3 tools/build_demo.py"""
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
.demo-tag{left:16px;right:auto}@media(max-width:499px){.demo-tag{display:none}}
</style>'''
for f in sorted(glob.glob(P + '*.dc.html')):
    n = os.path.basename(f)
    if n not in titles:
        continue
    s = open(f).read()
    xdc = re.search(r'<x-dc>([\s\S]*)</x-dc>', s).group(1)
    hel = re.search(r'<helmet>([\s\S]*?)</helmet>', xdc)
    helc = hel.group(1) if hel else ''
    tplc = xdc.replace(hel.group(0), '') if hel else xdc
    tplc = re.sub(r'/_blob/[0-9a-f]+', 'rentalaja-logo.png', tplc)
    scr = re.search(r'data-dc-script[^>]*>([\s\S]*?)</script>', s).group(1)
    title = re.search(r'<title>(.*?)</title>', s).group(1)
    extra = HP_CSS if n.endswith('Hp.dc.html') else ''
    out = f'''<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title} · Demo</title>
<meta name="robots" content="noindex">
{helc.strip()}
<style>.demo-tag{{position:fixed;right:16px;bottom:16px;z-index:50;background:#1D3149;color:#fff;font:700 12px/1 Nunito,system-ui,sans-serif;padding:10px 14px;border-radius:999px;text-decoration:none;box-shadow:0 6px 18px rgba(29,49,73,.3)}}.demo-tag b{{color:#09BEAF}}</style>
{extra}
<script src="runtime.js"></script>
</head>
<body>
<div id="root"></div>
<a class="demo-tag" href="index.html"><b>DEMO</b> · data contoh · semua layar</a>
<script type="text/plain" id="dc-tpl">{tplc}</script>
<script>
{scr}
dcBoot(Component);
</script>
</body>
</html>
'''
    open(O + n, 'w').write(out)
groups = [('Laptop · masuk & kerja harian', ['Masuk', 'Main', 'KKH', 'Penugasan', 'Review', 'Permintaan', 'Kehadiran']),
          ('Laptop · unit bisnis', ['Target', 'Omzet', 'Liga']),
          ('Laptop · orang & sistem', ['Tim', 'Bonus', 'Library', 'Peta', 'Pengaturan']),
          ('HP · tahap 1', ['KKHHp', 'ReviewHp', 'PermintaanHp', 'LainnyaHp']),
          ('Catatan CEO', ['Keputusan'])]
cards = ''
for g, items in groups:
    lis = ''.join(f'<a class="c" href="{i}.dc.html"><span>{html.escape(titles[i + ".dc.html"])}</span><i>›</i></a>' for i in items if i + '.dc.html' in titles)
    cards += f'<section><h2>{g}</h2><div class="g">{lis}</div></section>'
idx = open(O + 'index.html').read()
idx = re.sub(r'(<div class="n">.*?</div>)[\s\S]*?(</main>)', lambda m: m.group(1) + cards + m.group(2), idx)
open(O + 'index.html', 'w').write(idx)
print('built', len(glob.glob(O + '*.dc.html')), 'pages')
