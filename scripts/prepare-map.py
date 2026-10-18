"""Convert a locally downloaded Overpass JSON export to compact campus geometry.

Input is intentionally not committed. Query and attribution are documented in README.
"""
import json
import math
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "osm.json"
SOURCE_NORTH = ROOT / "osm-north-full.xml"
DEST = ROOT / "src" / "data" / "campus.json"
ORIGIN = (112.940, 28.175)
SCALE_X = 111320 * math.cos(math.radians(ORIGIN[1]))
SCALE_Z = 110950
ZONE_IDS = [486904540, 1545181607, 1545181608, 1545181609, 1545181614, 1540099722, 1540099723, 644418501, 644677463]
AREA_IDS = [272514061, 585142566, 272516772, 153312635, 272516775, 272516791,
            586904398, 404043864, 586904395, 586904437, 1019024282,
            586904399, 586904402]


def north_elements():
    root = ET.parse(SOURCE_NORTH).getroot()
    nodes = {n.get("id"): {"lat": float(n.get("lat")), "lon": float(n.get("lon"))} for n in root.findall("node")}
    result = []
    for way in root.findall("way"):
        geometry = [nodes[ref.get("ref")] for ref in way.findall("nd") if ref.get("ref") in nodes]
        if len(geometry) < 2:
            continue
        tags = {tag.get("k"): tag.get("v") for tag in way.findall("tag")}
        result.append({"type": "way", "id": int(way.get("id")), "geometry": geometry, "tags": tags})
    return result


def point(raw):
    return [round((raw["lon"] - ORIGIN[0]) * SCALE_X, 1), round((ORIGIN[1] - raw["lat"]) * SCALE_Z, 1)]


def inside(p, polygon):
    x, y = p
    hit = False
    for a, b in zip(polygon, polygon[1:] + polygon[:1]):
        if (a[1] > y) != (b[1] > y) and x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]:
            hit = not hit
    return hit


def centroid(points):
    vertices = points[:-1] if points[0] == points[-1] else points
    return [sum(p[0] for p in vertices) / len(vertices), sum(p[1] for p in vertices) / len(vertices)]


def simplify(points, tolerance=0.65):
    if len(points) < 4:
        return points
    closed = points[0] == points[-1]
    sequence = points[:-1] if closed else points

    def recurse(seq):
        if len(seq) < 3:
            return seq
        a, b = seq[0], seq[-1]
        dx, dy = b[0] - a[0], b[1] - a[1]
        norm = dx * dx + dy * dy
        distances = []
        for p in seq[1:-1]:
            t = max(0, min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / norm)) if norm else 0
            distances.append(math.dist(p, [a[0] + t * dx, a[1] + t * dy]))
        largest = max(distances)
        if largest <= tolerance:
            return [a, b]
        index = distances.index(largest) + 1
        return recurse(seq[: index + 1])[:-1] + recurse(seq[index:])

    result = recurse(sequence)
    return result + [result[0]] if closed else result


def main():
    combined = json.loads(SOURCE.read_text(encoding="utf-8"))["elements"] + north_elements()
    elements = list({(e["type"], e["id"]): e for e in combined}.values())
    ways = {e["id"]: e for e in elements if e["type"] == "way"}
    zones = [simplify([point(p) for p in ways[i]["geometry"]]) for i in ZONE_IDS]
    output = {"origin": list(ORIGIN), "zones": [], "areas": [], "buildings": [], "roads": []}
    for identifier, polygon in zip(ZONE_IDS, zones):
        output["zones"].append({"id": identifier, "name": ways[identifier]["tags"]["name"], "points": polygon})

    for e in elements:
        if e["type"] != "way" or "geometry" not in e:
            continue
        tags = e.get("tags", {})
        polygon = simplify([point(p) for p in e["geometry"]])
        if e["id"] in AREA_IDS:
            output["areas"].append({"id": e["id"], "name": tags.get("name", ""), "points": polygon})
        if "building" in tags and any(inside(centroid(polygon), zone) for zone in zones):
            output["buildings"].append({
                "id": e["id"], "name": tags.get("name", ""),
                "kind": tags.get("building", "yes"),
                "levels": tags.get("building:levels", ""),
                "points": polygon,
            })
        if "highway" in tags:
            c = centroid(polygon)
            near = any(inside(c, zone) for zone in zones) or (-500 < c[0] < 500 and -900 < c[1] < 650)
            if near and tags["highway"] not in ("steps", "track", "service"):
                output["roads"].append({"id": e["id"], "name": tags.get("name", ""), "kind": tags["highway"], "points": polygon})

    DEST.parent.mkdir(parents=True, exist_ok=True)
    DEST.write_text(json.dumps(output, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print({key: len(value) for key, value in output.items() if isinstance(value, list)})
    print(f"Wrote {DEST} ({DEST.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
