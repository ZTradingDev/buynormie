// normify: turns a photo into a Normie character with fal.ai (Nano Banana 2 Edit).
// The fal key stays here as the FAL_KEY secret; apps only ever call this function.
// Request:  POST { image: "data:image/jpeg;base64,..." }   (resize to ~1024px on the client first)
// Response: { url: "https://...png" }

const FAL_KEY = Deno.env.get("FAL_KEY") ?? "";
const MODEL = "fal-ai/nano-banana-2/edit";
const STYLE_REF = "https://buynormie.com/assets/normify/normie-style-ref.jpg";
const PROMPT =
  "Redraw the subject of the first image as a Normie character in the exact art style of the second image. " +
  "Style: clean bold black ink outlines, flat colors with soft cel shading, plain white background, full body, standing, slightly turned. " +
  "Face: the Normie look from the second image, a pale white face with tired heavy-lidded eyes, faint under-eye lines, " +
  "small flat neutral mouth and light forehead lines. " +
  "Keep the subject's own hairstyle, hair color, facial hair, glasses, clothing, colors and accessories from the first image. " +
  "If the subject is a pet or an object, draw it in the same style and give it the same pale tired Normie expression. " +
  "No text, no watermark, one character only.";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "POST only." }, 405);
  if (!FAL_KEY) return json({ error: "Normify isn’t switched on yet. Check back soon." }, 503);

  let image = "";
  try { image = (await req.json())?.image ?? ""; } catch { /* fall through */ }
  if (typeof image !== "string" || !/^data:image\/(jpeg|png|webp);base64,/.test(image))
    return json({ error: "Send a photo (JPEG, PNG or WebP)." }, 400);
  if (image.length > 7_000_000) return json({ error: "That photo is too large. Try a smaller one." }, 413);

  try {
    const r = await fetch(`https://fal.run/${MODEL}`, {
      method: "POST",
      headers: { Authorization: `Key ${FAL_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: PROMPT, image_urls: [image, STYLE_REF], num_images: 1, output_format: "png" }),
    });
    const out = await r.json().catch(() => ({}));
    const url = out?.images?.[0]?.url;
    if (!r.ok || !url) {
      console.error("fal error", r.status, JSON.stringify(out).slice(0, 500));
      return json({ error: "Normify didn’t work on that photo. Try another one." }, 502);
    }
    return json({ url });
  } catch (e) {
    console.error("normify failed", e);
    return json({ error: "Normify is busy. Try again in a moment." }, 502);
  }
});
