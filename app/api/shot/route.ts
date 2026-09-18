import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

// Dev-only: persists canvas frames for visual QA. Disabled in production builds.
export async function POST(req: Request) {
  if (process.env.NODE_ENV === "production") return new Response("disabled", { status: 404 });
  const { name, data } = (await req.json()) as { name: string; data: string };
  const dir = process.env.SHOT_DIR ?? path.join(process.cwd(), ".shots");
  await mkdir(dir, { recursive: true });
  const safe = name.replace(/[^a-z0-9_.-]/gi, "_");
  await writeFile(path.join(dir, safe + ".jpg"), Buffer.from(data.split(",")[1], "base64"));
  return Response.json({ ok: true });
}
