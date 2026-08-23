import fs from "node:fs";
import path from "node:path";

const SHIPPED_REL = "docs/SHIPPED_FEATURES_TEST_APPENDIX.md";

export function readShippedDoc(root) {
  return fs.readFileSync(path.join(root, SHIPPED_REL), "utf8");
}

/** Extract one feature section (# F01 — …) from the consolidated shipped doc. */
export function featureDoc(root, featureId) {
  const full = readShippedDoc(root);
  const marker = `# ${featureId} —`;
  const start = full.indexOf(marker);
  if (start < 0) {
    throw new Error(`Missing ${marker} in ${SHIPPED_REL}`);
  }
  const tail = full.slice(start + marker.length);
  const next = tail.search(/\n# F\d{2} —/);
  const end = next < 0 ? full.length : start + marker.length + next;
  return full.slice(start, end);
}
