export function detectPlatformLinks(row: Record<string, string>) {
  const platforms = {
    shopee: row['link_shopee'] || row['meta:link_shopee'] || row['shopee_link'] || null,
    tiki: row['link_tiktok'] || row['meta:link_tiktok'] || null,
    lazada: row['link_lazada'] || row['meta:link_lazada'] || null,
    dmx: row['link_dmx'] || row['meta:link_dmx'] || null,
  }
  return platforms
}
