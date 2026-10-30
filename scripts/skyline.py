"""Builds an ASCII STL skyline from site/data.json and writes it into README.md
between <!-- skyline:start --> and <!-- skyline:end -->. GitHub renders it as a 3D viewer."""
import json, datetime as dt, pathlib, re

ROOT = pathlib.Path(__file__).resolve().parent.parent
d = json.loads((ROOT / "site/data.json").read_text())
C, start = d["counts"], dt.date.fromisoformat(d["start"])
f = next(i for i, c in enumerate(C) if c > 0)            # skip the empty lead-in
f -= (start + dt.timedelta(f)).isoweekday() % 7
f = max(f, 0); C = C[f:]; dow0 = (start + dt.timedelta(f)).isoweekday() % 7
mx = max(C); out = ["solid contributions"]
r = lambda v: f"{v:.2f}".rstrip("0").rstrip(".")

def tri(a, b, c, n):
    out.append(f"facet normal {n[0]} {n[1]} {n[2]}\nouter loop\nvertex {' '.join(map(r,a))}\nvertex {' '.join(map(r,b))}\nvertex {' '.join(map(r,c))}\nendloop\nendfacet")

def box(x0, y0, z0, x1, y1, z1, bottom=True):
    q = [([(x0,y0,z1),(x1,y0,z1),(x1,y1,z1),(x0,y1,z1)], (0,0,1)),
         ([(x0,y0,z0),(x1,y0,z0),(x1,y0,z1),(x0,y0,z1)], (0,-1,0)),
         ([(x1,y1,z0),(x0,y1,z0),(x0,y1,z1),(x1,y1,z1)], (0,1,0)),
         ([(x0,y1,z0),(x0,y0,z0),(x0,y0,z1),(x0,y1,z1)], (-1,0,0)),
         ([(x1,y0,z0),(x1,y1,z0),(x1,y1,z1),(x1,y0,z1)], (1,0,0))]
    if bottom: q.append(([(x0,y1,z0),(x1,y1,z0),(x1,y0,z0),(x0,y0,z0)], (0,0,-1)))
    for (a, b, c, e), n in q: tri(a, b, c, n); tri(a, c, e, n)

weeks = (len(C) + dow0 + 6) // 7
box(-1, -1, -1.5, weeks + 0.15, 7.15, 0)
for i, c in enumerate(C):
    if not c: continue
    w, day = divmod(i + dow0, 7)
    box(w + 0.08, 6 - day + 0.08, 0, w + 0.92, 6 - day + 0.92, 0.5 + c / mx * 11, bottom=False)
out.append("endsolid contributions")

stl = "```stl\n" + "\n".join(out) + "\n```"
readme = ROOT / "README.md"; text = readme.read_text()
new = re.sub(r"<!-- skyline:start -->.*?<!-- skyline:end -->",
             lambda m: "<!-- skyline:start -->\n" + stl + "\n<!-- skyline:end -->", text, flags=re.S)
readme.write_text(new)
print(f"skyline: {sum(1 for c in C if c)} bars over {weeks} weeks, {len(stl)//1024} KB")
