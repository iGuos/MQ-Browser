/** Returns null if valid, otherwise an i18n key (without leading `validation.`). */

/**
 * AMQP queue / exchange / vhost names: broker accepts most printable chars
 * but spaces / control chars break round-tripping in URLs and the management
 * UI. We disallow leading/trailing spaces and ASCII control chars; pretty
 * lenient otherwise.
 */
export function validateAmqpName(name: string): string | null {
  if (!name) return 'required'
  if (name !== name.trim()) return 'noLeadingTrailingSpace'
  // eslint-disable-next-line no-control-regex
  if (/[\x00-\x1f\x7f]/.test(name)) return 'noControlChars'
  if (name.length > 255) return 'tooLong'
  return null
}

export function validateUsername(name: string): string | null {
  if (!name) return 'required'
  if (name !== name.trim()) return 'noLeadingTrailingSpace'
  if (name.length > 128) return 'tooLong'
  return null
}

/** JS-side regex syntax check: returns the SyntaxError message or null. */
export function validateRegex(pattern: string): string | null {
  if (pattern === '' || pattern === '.*') return null
  try {
    new RegExp(pattern)
    return null
  } catch (e) {
    return e instanceof Error ? e.message : 'invalidRegex'
  }
}

/**
 * `host` field: must NOT include scheme — pasting `https://foo.bar` is a
 * common mistake that produces `https://https://foo.bar` URLs.
 */
export function validateHost(host: string): string | null {
  if (!host) return 'required'
  if (/^https?:\/\//i.test(host)) return 'noScheme'
  if (/\s/.test(host)) return 'noWhitespace'
  return null
}

export function passwordStrength(p: string): 'empty' | 'weak' | 'fair' | 'strong' {
  if (!p) return 'empty'
  let score = 0
  if (p.length >= 8) score++
  if (p.length >= 12) score++
  if (/[a-z]/.test(p) && /[A-Z]/.test(p)) score++
  if (/\d/.test(p)) score++
  if (/[^A-Za-z0-9]/.test(p)) score++
  if (score >= 4) return 'strong'
  if (score >= 2) return 'fair'
  return 'weak'
}
