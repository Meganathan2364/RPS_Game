# Rebuilds rps-arena-single.html (game + dashboard in ONE file) from css/ and js/.  Run: python tools/build_single.py
import re
from pathlib import Path
root = Path(__file__).resolve().parent.parent
rd = lambda p: (root / p).read_text(encoding='utf-8')
strip = lambda js: re.sub(r'^export\s+', '', re.sub(r'^import .*\n', '', js, flags=re.M), flags=re.M)
def scope(css):
    out = []
    for rule in css.strip().split('}'):
        if rule.strip():
            sel, body = rule.split('{', 1)
            out.append(','.join('#dash ' + x.strip() for x in sel.split(',')) + '{' + body + '}')
    return '\n'.join(out)
dash = strip(rd('js/dashboard.js')).replace('const $ = s =>', 'const Q = s =>').replace("$('#", "Q('#")
parts = [strip(rd('js/hand3d.js')), strip(rd('js/symbols.js').replace('const T = THREE;', '')), strip(rd('js/tracker.js')), strip(rd('js/storage.js')),
         'const store = { load, save, player, clearAll };', strip(rd('js/brain.js')), strip(rd('js/main.js')),
         'function openDash() {\n' + dash + '\n}',
         "$('bdash').onclick = e => { e.preventDefault(); $('dash').hidden = false; openDash(); };\n$('back').onclick = e => { e.preventDefault(); $('dash').hidden = true; };"]
js = '\n'.join(parts)
css = rd('css/style.css') + '\n#dash{position:fixed;inset:0;z-index:5;overflow:auto;background:var(--ink)}\n#dash[hidden]{display:none}\n' + scope('\n'.join(rd('css/dashboard.css').split('\n')[2:]))
body = rd('index.html').split('<body>')[1].split('<script src=')[0].replace('<a href="dashboard.html">Open dashboard</a>', '<a href="#" id="bdash">Open dashboard</a>')
dh = '<div id="dash" hidden><header><a href="#" id="back">Back to game</a><select id="who" aria-label="Player"></select><button id="exp" class="alt" type="button">Export JSON</button><button id="clr" class="alt" type="button">Clear all data</button></header><main id="out"></main></div>\n'
html = ('<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">\n<title>Stone Paper Scissors</title>\n'
        '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@500;700;800&display=swap">\n<style>\n' + css + '\n</style></head><body>\n' + body + dh +
        '<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>\n<script type="module">\n' + js + '\n</script>\n</body></html>\n')
(root / 'rps-arena-single.html').write_text(html, encoding='utf-8')
Path('/tmp/bundle.mjs').write_text(js, encoding='utf-8')
print('built', len(html), 'bytes')
