/**
 * Launcher geometry — one source for the button, the studio preview and the host frame size.
 * "pill" md (68×40, radius 16) is the original AIDE launcher.
 */
const BOXES = {
  pill: { sm: [60, 36], md: [68, 40], lg: [80, 48] },
  circle: { sm: [44, 44], md: [56, 56], lg: [64, 64] },
  square: { sm: [44, 44], md: [52, 52], lg: [60, 60] },
};

export function launcherBox(deploy = {}) {
  const shape = BOXES[deploy.launcherShape] ? deploy.launcherShape : "pill";
  const size = ["sm", "md", "lg"].includes(deploy.launcherSize) ? deploy.launcherSize : "md";
  const [width, height] = BOXES[shape][size];
  const radius = shape === "circle" ? height / 2 : shape === "square" ? 12 : 16;
  return { shape, size, width, height, radius };
}

/** Space the closed launcher needs inside the host iframe (button + gutter). */
export function launcherFrame(deploy = {}) {
  const box = launcherBox(deploy);
  return { width: Math.max(80, box.width + 12), height: Math.max(56, box.height + 16) };
}
