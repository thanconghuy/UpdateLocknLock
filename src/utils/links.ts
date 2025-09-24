export function detectPlatformLinks(input: Record<string, string> | string) {
  // If input is a string (description), extract links from text
  if (typeof input === 'string') {
    return detectLinksFromText(input)
  }

  // If input is a record (CSV row), use existing logic
  const row = input
  const platforms = {
    shopee: row['link_shopee'] || row['meta:link_shopee'] || row['shopee_link'] || null,
    tiktok: row['link_tiktok'] || row['meta:link_tiktok'] || null,
    tiki: row['link_tiki'] || row['meta:link_tiki'] || null,
    lazada: row['link_lazada'] || row['meta:link_lazada'] || null,
    dmx: row['link_dmx'] || row['meta:link_dmx'] || null,
  }
  return platforms
}

function detectLinksFromText(text: string) {
  // URL patterns for Vietnamese e-commerce platforms
  const patterns = {
    shopee: /https?:\/\/(?:www\.)?shopee\.vn\/[^\s\)]+/gi,
    tiktok: /https?:\/\/(?:www\.)?(?:tiktok\.com\/.*shop|tiktokshop\.com|vt\.tiktok\.com)\/[^\s\)]+/gi,
    tiki: /https?:\/\/(?:www\.)?tiki\.vn\/[^\s\)]+/gi,
    lazada: /https?:\/\/(?:www\.)?lazada\.vn\/[^\s\)]+/gi,
    dmx: /https?:\/\/(?:www\.)?dienmayxanh\.com\/[^\s\)]+/gi,
  }

  const platforms: { [key: string]: string | null } = {}

  for (const [platform, pattern] of Object.entries(patterns)) {
    const matches = text.match(pattern)
    platforms[platform] = matches ? matches[0] : null
  }

  return platforms
}
