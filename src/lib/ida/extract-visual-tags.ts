/**
 * extractVisualTags
 *
 * Runs Claude Haiku vision on a product image URL and returns a set of
 * descriptive lowercase tags: colour, pattern, texture, material, and style.
 *
 * Called at save time (not scrape time) so we only analyse the image the
 * user actually chose, not all candidate images.
 *
 * Returns an empty array on failure — always non-throwing.
 */

export async function extractVisualTags(imageUrl: string): Promise<string[]> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Anthropic = require("@anthropic-ai/sdk");
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not configured");
    const client = new Anthropic.default({ apiKey });

    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 256,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "url",
                url: imageUrl,
              },
            },
            {
              type: "text",
              text: `Analyse this product image for an interior design procurement library.
Return a JSON array of descriptive lowercase tags — no prose, no explanation.

Focus on:
- Colour: be specific (e.g. "dusty rose", "charcoal", "ivory", "sage", "terracotta", "navy", "cream", "stone")
- Pattern: e.g. "geometric", "plain", "floral", "abstract", "stripe", "check", "herringbone", "damask", "textured plain"
- Texture: e.g. "woven", "pile", "smooth", "ribbed", "bouclé", "embossed", "matte", "sheen", "velvet"
- Material appearance: e.g. "fabric", "marble", "wood grain", "leather", "wallpaper", "tile", "metal"
- Style feel: e.g. "contemporary", "traditional", "natural", "bold", "minimal", "maximalist", "organic"

Return maximum 8 tags. Return ONLY a JSON array: ["tag1", "tag2", ...]`,
            },
          ],
        },
      ],
    });

    const text =
      response.content[0].type === "text" ? response.content[0].text : "";
    const match = text.match(/\[[\s\S]*\]/);
    if (!match) return [];

    const parsed = JSON.parse(match[0]) as unknown;
    if (!Array.isArray(parsed)) return [];

    return (parsed as unknown[])
      .filter((t): t is string => typeof t === "string")
      .map((t) => t.toLowerCase().trim())
      .filter(Boolean)
      .slice(0, 8);
  } catch (err) {
    console.error("[extract-visual-tags] Vision analysis failed:", err);
    return [];
  }
}
