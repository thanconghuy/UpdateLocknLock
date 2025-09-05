export function isValidUrl(v: string) {
  try {
    if (!v) return false
    const u = new URL(v)
    return ['http:', 'https:'].includes(u.protocol)
  } catch (err) {
    return false
  }
}

export function cleanPrice(v: string) {
  if (!v) return null
  return v.replace(/[^0-9.]/g, '')
}
