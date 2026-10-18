import test from "node:test";
import assert from "node:assert/strict";
import { centroid, pointInPolygon, seeded, walkDirection } from "../src/geo.js";

test("centroid ignores a repeated closing vertex", () => {
  assert.deepEqual(
    centroid([
      [0, 0],
      [10, 0],
      [10, 10],
      [0, 10],
      [0, 0],
    ]),
    [5, 5],
  );
});

test("building hit testing excludes the outside of a concave footprint", () => {
  const footprint = [
    [0, 0],
    [8, 0],
    [8, 3],
    [3, 3],
    [3, 8],
    [0, 8],
    [0, 0],
  ];
  assert.equal(pointInPolygon([1, 7], footprint), true);
  assert.equal(pointInPolygon([7, 7], footprint), false);
});

test("seeded generation is repeatable for campus vegetation", () => {
  const a = seeded(17),
    b = seeded(17);
  assert.deepEqual([a(), a(), a()], [b(), b(), b()]);
});

test("first-person movement follows the camera after a quarter turn", () => {
  const forward = walkDirection(Math.PI / 2, 1, 0);
  assert.ok(Math.abs(forward[0] + 1) < 1e-8);
  assert.ok(Math.abs(forward[1]) < 1e-8);
  const right = walkDirection(Math.PI / 2, 0, 1);
  assert.ok(Math.abs(right[0]) < 1e-8);
  assert.ok(Math.abs(right[1] + 1) < 1e-8);
});
