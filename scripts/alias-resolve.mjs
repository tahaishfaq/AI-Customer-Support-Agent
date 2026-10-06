import fs from "node:fs";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function resolveFile(absWithoutExt) {
  const candidates = [
    absWithoutExt,
    `${absWithoutExt}.ts`,
    `${absWithoutExt}.tsx`,
    `${absWithoutExt}.js`,
    `${absWithoutExt}.jsx`,
    `${absWithoutExt}.mjs`,
    path.join(absWithoutExt, "index.ts"),
    path.join(absWithoutExt, "index.js"),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return pathToFileURL(candidate).href;
    }
  }
  return null;
}

function resolveAlias(specifier) {
  const abs = path.join(root, specifier.slice(2));
  return resolveFile(abs) || pathToFileURL(`${abs}.js`).href;
}

/** Extensionless relative imports → real file so node --test matches Next/tsx resolution. */
function resolveRelative(specifier, parentURL) {
  if (!parentURL?.startsWith("file:")) return null;
  if (!specifier.startsWith("./") && !specifier.startsWith("../")) return null;
  // Already has an extension — leave to Node.
  if (/\.[a-zA-Z0-9]+$/.test(path.basename(specifier))) return null;
  const parentDir = path.dirname(fileURLToPath(parentURL));
  const abs = path.resolve(parentDir, specifier);
  return resolveFile(abs);
}

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("@/")) {
    return {
      shortCircuit: true,
      url: resolveAlias(specifier),
    };
  }
  const relative = resolveRelative(specifier, context.parentURL);
  if (relative) {
    return {
      shortCircuit: true,
      url: relative,
    };
  }
  // Next.js package exports omit bare "next/server" for plain Node ESM; append .js.
  if (specifier === "next/server" || specifier === "next/headers" || specifier === "next/navigation") {
    return nextResolve(`${specifier}.js`, context);
  }
  return nextResolve(specifier, context);
}
