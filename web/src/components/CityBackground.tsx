// Deterministic skyline, not Math.random() — a fixed shape means no
// hydration/remount flicker and no need for a seeded RNG for something
// this small. Two layers (back = shorter, lighter, tighter gaps; front =
// taller, darker) give it depth without any real 3D or image asset.
const BACK_HEIGHTS = [60, 90, 40, 120, 70, 100, 50, 140, 80, 60, 110, 45, 95, 65, 130, 55, 85, 105, 40, 120, 70, 90, 50, 100];
const FRONT_HEIGHTS = [180, 240, 140, 300, 200, 260, 160, 340, 190, 220, 280, 150, 320, 170, 250, 210, 290, 160, 230, 310, 180, 200, 150, 270];

const WINDOWS = [
  { x: 62, y: 610, layer: "front" },
  { x: 145, y: 520, layer: "front" },
  { x: 210, y: 470, layer: "front" },
  { x: 340, y: 400, layer: "front" },
  { x: 520, y: 440, layer: "front" },
  { x: 690, y: 380, layer: "front" },
  { x: 810, y: 460, layer: "front" },
  { x: 940, y: 350, layer: "front" },
  { x: 1080, y: 420, layer: "front" },
  { x: 1200, y: 480, layer: "front" },
  { x: 1330, y: 400, layer: "front" },
  { x: 1450, y: 460, layer: "front" },
] as const;

function skylinePath(heights: number[], width: number, baseY: number): string {
  const buildingWidth = width / heights.length;
  let d = `M0,${baseY}`;
  heights.forEach((h, i) => {
    const x = i * buildingWidth;
    const y = baseY - h;
    d += ` L${x},${y} L${x + buildingWidth},${y}`;
  });
  d += ` L${width},${baseY} Z`;
  return d;
}

const VIEWBOX_WIDTH = 1600;
const VIEWBOX_HEIGHT = 900;

export function CityBackground() {
  return (
    <div className="landing__background" aria-hidden="true">
      <svg
        viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
        preserveAspectRatio="xMidYMax slice"
        className="landing__skyline"
      >
        <path d={skylinePath(BACK_HEIGHTS, VIEWBOX_WIDTH, VIEWBOX_HEIGHT)} fill="#3a3a44" />
        <path d={skylinePath(FRONT_HEIGHTS, VIEWBOX_WIDTH, VIEWBOX_HEIGHT)} fill="#232329" />
        {WINDOWS.map((w) => (
          <rect key={`${w.x}-${w.y}`} x={w.x} y={w.y} width="6" height="8" fill="#e8b768" opacity="0.55" />
        ))}
      </svg>
      <div className="landing__scrim" />
    </div>
  );
}
