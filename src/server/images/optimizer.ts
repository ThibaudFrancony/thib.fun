import "server-only";

import { createRequire } from "node:module";

type ImageOptimizerTools = typeof import("next/dist/server/image-optimizer");

const requireFromServer = createRequire(import.meta.url);

/**
 * Le module Next expose `detectContentType` et `getSharp` depuis ses
 * dépendances serveur. Le require différé évite d'embarquer les binaires
 * natifs dans le bundle Webpack.
 */
export function imageOptimizerTools(): Pick<ImageOptimizerTools, "detectContentType" | "getSharp"> {
  const moduleName = ["next", "dist", "server", "image-optimizer"].join("/");
  return requireFromServer(moduleName) as Pick<ImageOptimizerTools, "detectContentType" | "getSharp">;
}

export const ALLOWED_IMAGE_CONTENT_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
