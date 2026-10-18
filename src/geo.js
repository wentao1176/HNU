export function centroid(points) {
  const vertices =
    points.length > 1 &&
    points[0][0] === points.at(-1)[0] &&
    points[0][1] === points.at(-1)[1]
      ? points.slice(0, -1)
      : points;
  return vertices.reduce(
    (sum, p) => [
      sum[0] + p[0] / vertices.length,
      sum[1] + p[1] / vertices.length,
    ],
    [0, 0],
  );
}

export function pointInPolygon(point, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i],
      b = polygon[j];
    if (
      a[1] > point[1] !== b[1] > point[1] &&
      point[0] < ((b[0] - a[0]) * (point[1] - a[1])) / (b[1] - a[1]) + a[0]
    )
      inside = !inside;
  }
  return inside;
}

export function seeded(seed) {
  let state = seed >>> 0;
  return () => (state = (state * 1664525 + 1013904223) >>> 0) / 4294967296;
}

export function walkDirection(yaw, forward, strafe) {
  return [
    -Math.sin(yaw) * forward + Math.cos(yaw) * strafe,
    -Math.cos(yaw) * forward - Math.sin(yaw) * strafe,
  ];
}
