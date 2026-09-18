export type Tier = "high" | "medium" | "low" | "safe";

const SAFE_KEY = "poa-safe-graphics";

/** Remember that this device lost its WebGL context, so the next visit starts in safe mode. */
export function rememberSafeMode() {
  try {
    localStorage.setItem(SAFE_KEY, "1");
  } catch {}
}

export function forgetSafeMode() {
  try {
    localStorage.removeItem(SAFE_KEY);
  } catch {}
}

/**
 * Pick a starting quality tier from the WebGL renderer string, before the
 * scene mounts (so shaders are compiled once with the right features).
 *
 * "safe" is for drivers known to fault under heavy WebGL (nouveau, the
 * open-source NVIDIA driver, reports itself through ANGLE as e.g.
 * "ANGLE (Mesa, NVD9, OpenGL ES 3.1)") and for software rasterisers:
 * no post-processing, no shadow maps, no render-to-texture reflections.
 */
export function detectTier(): { tier: Tier; renderer: string; reason: string } {
  const q = new URLSearchParams(window.location.search).get("q");
  let renderer = "unknown";
  try {
    const c = document.createElement("canvas");
    const gl = c.getContext("webgl2");
    if (!gl) return { tier: "safe", renderer: "no-webgl2", reason: "no WebGL 2" };
    const ext = gl.getExtension("WEBGL_debug_renderer_info");
    renderer = String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
    gl.getExtension("WEBGL_lose_context")?.loseContext();
  } catch {
    return { tier: "safe", renderer, reason: "WebGL probe failed" };
  }
  if (q === "high" || q === "medium" || q === "low" || q === "safe") {
    if (q !== "safe") forgetSafeMode();
    return { tier: q, renderer, reason: "requested" };
  }
  try {
    if (localStorage.getItem(SAFE_KEY) === "1") return { tier: "safe", renderer, reason: "graphics driver reset on a previous visit" };
  } catch {}

  const r = renderer.toLowerCase();
  const linux = /linux/i.test(navigator.userAgent) && !/android/i.test(navigator.userAgent);
  const mobile = /android|iphone|ipad/i.test(navigator.userAgent);
  // nouveau: "nouveau", or Mesa exposing an NVIDIA codename (NV50, NVC1, NVD9, NVE7, NV106…)
  const nouveau = /nouveau/.test(r) || (/mesa/.test(r) && /\bnv[0-9a-f]{2,3}\b/.test(r));
  // Firefox masks renderers; on Linux an old generic GeForce bucket is almost always nouveau
  const firefoxOldNvidia = linux && /or similar/.test(r) && /geforce (gtx? )?[4-7][0-9]{2}\b/.test(r);
  if (nouveau || firefoxOldNvidia) return { tier: "safe", renderer, reason: "open-source NVIDIA driver (nouveau)" };
  if (/llvmpipe|swiftshader|softpipe|software|microsoft basic/.test(r)) return { tier: "safe", renderer, reason: "software rendering" };
  if (mobile || /intel|mali|adreno|powervr|apple m1\b/.test(r)) return { tier: "medium", renderer, reason: "integrated / mobile GPU" };
  return { tier: "high", renderer, reason: "discrete GPU" };
}
