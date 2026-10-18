import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { centroid } from "../src/geo.js";
import { landmarks } from "../src/data/landmarks.js";

const campus = JSON.parse(
  readFileSync(new URL("../src/data/campus.json", import.meta.url), "utf8"),
);
const records = new Map(
  [...campus.buildings, ...campus.zones, ...campus.areas].map((p) => [p.id, p]),
);
const at = (id) => centroid(records.get(id).points);

test("every curated destination resolves to mapped geometry or an explicit group position", () => {
  for (const p of landmarks)
    assert.ok(
      p.position ||
        (p.members?.length && p.members.every((id) => records.has(id))) ||
        records.has(p.id),
      `Missing map feature: ${p.name}`,
    );
});

test("key teaching buildings and residential districts keep the verified geographic order", () => {
  assert.ok(at(272516776)[0] > at(272516773)[0], "中楼在复临舍以东");
  assert.ok(at(54827271)[0] > at(272514061)[0], "体育馆在南校区运动场以东");
  assert.ok(at(272516773)[1] < at(1150591611)[1], "复临舍在研楼以北");
  assert.ok(at(1150591611)[1] < at(307871886)[1], "研楼在综合楼以北");
  assert.ok(at(307871886)[1] < at(1545181609)[1], "综合楼在天马一区以北");
  assert.ok(at(1540099722)[0] < at(1545181608)[0], "德智西区在天马三区以西");
  assert.ok(
    at(644418501)[0] < at(272516791)[0] && at(644418501)[1] < at(272516791)[1],
    "财院校区在岳麓书院西北方向",
  );
});

test("all building footprints remain finite closed polygons after simplification", () => {
  for (const b of campus.buildings) {
    assert.ok(b.points.length >= 4, `Insufficient vertices: ${b.id}`);
    assert.deepEqual(b.points[0], b.points.at(-1), `Open footprint: ${b.id}`);
    for (const p of b.points)
      assert.ok(p.every(Number.isFinite), `Invalid coordinate: ${b.id}`);
  }
});

test("expanded export includes both previously truncated boundary regions", () => {
  assert.ok(
    campus.buildings.some((b) =>
      b.points.some((p) => p[1] < -1200 && p[0] > -700),
    ),
    "南校区北缘",
  );
  assert.ok(
    campus.buildings.some((b) => b.points.some((p) => p[1] > 1150)),
    "德智西区南缘",
  );
  assert.ok(at(586904396)[1] < -3100, "财院校区北部水上教学楼");
  assert.ok(
    records.get(644677463).points.some((p) => p[1] < -3400),
    "望麓桥公寓园区边界",
  );
});
