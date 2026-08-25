// Lightweight, dependency-free HTML sanitizer for admin-authored lesson content.
//
// Course HTML is written/uploaded only by platform admins (the PATCH route is
// `requireAdmin`-gated), so this is defense-in-depth rather than a hard trust
// boundary: it strips the obvious script-injection vectors before the HTML is
// stored and later rendered to learners via `dangerouslySetInnerHTML`.
//
// It is intentionally conservative and NOT a full HTML parser — do not rely on
// it to make untrusted user HTML safe. It removes:
//   • <script>/<style>/<object>/<embed>/<link>/<meta> element blocks
//   • inline event handlers (on*="…")
//   • javascript: URLs in href/src/etc.
// while preserving normal formatting, images, links and iframe embeds (e.g.
// video), which lessons legitimately use.

const BLOCK_TAGS = ["script", "style", "object", "embed", "link", "meta", "base"];

export function sanitizeLessonHtml(input: string): string {
  let html = String(input ?? "");

  // Drop dangerous element blocks (with or without a closing tag).
  for (const tag of BLOCK_TAGS) {
    html = html.replace(new RegExp(`<${tag}\\b[\\s\\S]*?<\\/${tag}>`, "gi"), "");
    html = html.replace(new RegExp(`<${tag}\\b[^>]*\\/?>`, "gi"), "");
  }

  // Strip inline event-handler attributes: on...="..." | on...='...' | on...=value
  html = html.replace(/\son[a-z]+\s*=\s*"[^"]*"/gi, "");
  html = html.replace(/\son[a-z]+\s*=\s*'[^']*'/gi, "");
  html = html.replace(/\son[a-z]+\s*=\s*[^\s>]+/gi, "");

  // Neutralise javascript:/vbscript: URLs in any attribute.
  html = html.replace(/(href|src|xlink:href|action|formaction)\s*=\s*"(?:\s*)(?:javascript|vbscript):[^"]*"/gi, '$1="#"');
  html = html.replace(/(href|src|xlink:href|action|formaction)\s*=\s*'(?:\s*)(?:javascript|vbscript):[^']*'/gi, "$1='#'");

  return html.trim();
}
