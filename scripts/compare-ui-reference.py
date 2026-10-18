"""Compare aligned, unscaled UI captures. Requires Pillow; never uploads images."""
import argparse
import base64
import io
import json
from pathlib import Path
from PIL import Image, ImageChops, ImageDraw, ImageEnhance

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("reference", type=Path)
parser.add_argument("actual", type=Path)
parser.add_argument("--crop", nargs=4, type=int, metavar=("LEFT", "TOP", "RIGHT", "BOTTOM"))
parser.add_argument("--measurements", type=Path, help="JSON with scale and boxes: name, selector, reference [x,y,w,h]")
parser.add_argument("--geometry", type=Path, help="Playwright geometry JSON, in CSS pixels")
parser.add_argument("--output", type=Path, required=True)
args = parser.parse_args()
reference = Image.open(args.reference).convert("RGB")
if args.crop:
    reference = reference.crop(tuple(args.crop))
actual = Image.open(args.actual).convert("RGB")
if reference.size != actual.size:
    parser.error(f"Captures must have the same pixel dimensions; got {reference.size} and {actual.size}. No scaling is applied.")
args.output.mkdir(parents=True, exist_ok=True)
reference.save(args.output / "reference-aligned.png")
overlay = Image.blend(reference, actual, 0.5)
overlay.save(args.output / "overlay-50.png")
ImageEnhance.Contrast(ImageChops.difference(reference, actual)).enhance(4).save(args.output / "difference-x4.png")
report = {"referenceCrop": args.crop, "size": reference.size, "rescaled": False,
          "note": "Different conversation content is not a geometry failure. No global similarity score is inferred.", "boxes": []}
if args.measurements and args.geometry:
    measurements = json.loads(args.measurements.read_text(encoding="utf-8-sig"))
    geometry = json.loads(args.geometry.read_text(encoding="utf-8-sig"))["geometry"]
    draw = ImageDraw.Draw(overlay)
    scale = measurements["scale"]
    for item in measurements["boxes"]:
        candidates = [value for value in geometry if item["selector"] in value["class"].split()]
        measured = candidates[item.get("index", 0)]
        box = [round(measured[key] * scale, 2) for key in ("x", "y", "width", "height")]
        target = item["reference"]
        delta = [round(a - b, 2) for a, b in zip(box, target)]
        report["boxes"].append({**item, "actual": box, "delta": delta})
        for bounds, color in ((target, "#e4555f"), (box, "#168de2")):
            x, y, w, h = bounds
            draw.rectangle((x, y, x + w, y + h), outline=color, width=2)
        draw.text((box[0] + 4, box[1] + 3), f'{item["name"]}: delta {delta}', fill="#0072b8", stroke_width=1, stroke_fill="white")
    overlay.save(args.output / "overlay-measured.png")
(args.output / "measurements.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
def image_uri(value):
    buffer = io.BytesIO()
    value.save(buffer, format="PNG")
    return "data:image/png;base64," + base64.b64encode(buffer.getvalue()).decode("ascii")

payload = json.dumps({"reference": image_uri(reference), "actual": image_uri(actual), "report": report}).replace("<", "\\u003c")
viewer = """<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>Pilaude UI reference layers</title>
<style>body{margin:0;background:#f4f4f2;color:#252525;font:14px system-ui}header{position:sticky;top:0;z-index:3;padding:14px 20px;background:#fff;border-bottom:1px solid #ddd;display:flex;gap:20px;align-items:center;flex-wrap:wrap}label{display:flex;gap:8px;align-items:center}main{padding:20px;overflow:auto}.frame{position:relative;transform-origin:top left}.frame>img{position:absolute;inset:0}.actual{opacity:.5}.frame.difference .actual{mix-blend-mode:difference;opacity:1!important}.box{position:absolute;box-sizing:border-box;border:2px solid;pointer-events:none}.reference-box{border-color:#e4555f}.actual-box{border-color:#168de2}table{margin:20px;border-collapse:collapse}td,th{padding:8px 12px;border-bottom:1px solid #ddd;text-align:left}small{color:#666}input[type=range]{width:180px}</style>
<header><strong>参考层 / 运行层</strong><label>运行层不透明度 <input id="alpha" type="range" min="0" max="100" value="50"><output id="value">50%</output></label><label>查看比例 <select id="zoom"><option value=".5">50%</option><option value="1" selected>100% 原像素</option><option value="1.5">150%</option></select></label><label><input id="difference" type="checkbox">差分</label><label><input id="boxes" type="checkbox" checked>边界：红参考 / 蓝实现</label><small>本机图片，无网络请求；仅查看比例改变，测量始终使用原像素。</small></header>
<main><div id="space"><div class="frame" id="frame"><img id="reference" alt="参考窗口"><img class="actual" id="actual" alt="实际运行窗口"></div></div></main><table><thead><tr><th>组件</th><th>参考 x,y,w,h</th><th>运行 x,y,w,h</th><th>偏差（物理像素）</th></tr></thead><tbody id="rows"></tbody></table><script>
const data=PAYLOAD, frame=document.getElementById('frame'), space=document.getElementById('space');
document.getElementById('reference').src=data.reference;document.getElementById('actual').src=data.actual;
const [w,h]=data.report.size;frame.style.width=w+'px';frame.style.height=h+'px';space.style.height=h+'px';
for(const box of data.report.boxes){const tr=document.createElement('tr');for(const value of [box.name,box.reference.join(', '),box.actual.join(', '),box.delta.join(', ')]){const td=document.createElement('td');td.textContent=value;tr.append(td)}document.getElementById('rows').append(tr);for(const [bounds,kind] of [[box.reference,'reference'],[box.actual,'actual']]){const el=document.createElement('div');el.className='box '+kind+'-box';const[x,y,width,height]=bounds;Object.assign(el.style,{left:x+'px',top:y+'px',width:width+'px',height:height+'px'});frame.append(el)}}
document.getElementById('alpha').oninput=e=>{document.getElementById('actual').style.opacity=e.target.value/100;document.getElementById('value').textContent=e.target.value+'%'};
document.getElementById('difference').onchange=e=>frame.classList.toggle('difference',e.target.checked);
document.getElementById('boxes').onchange=e=>document.querySelectorAll('.box').forEach(box=>box.hidden=!e.target.checked);
document.getElementById('zoom').onchange=e=>{const scale=Number(e.target.value);frame.style.transform='scale('+scale+')';space.style.width=w*scale+'px';space.style.height=h*scale+'px'};
</script></html>""".replace("PAYLOAD", payload)
(args.output / "viewer.html").write_text(viewer, encoding="utf-8")
print(json.dumps(report, ensure_ascii=False))
