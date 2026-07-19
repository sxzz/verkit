import {
  MAX_LENGTH,
  MAX_SAFE_BUILD_LENGTH,
  MAX_SAFE_COMPONENT_LENGTH,
} from '../constants.ts'

export const LETTER_DASH_NUMBER: string = '[a-zA-Z0-9-]'
export const NUMERIC_IDENTIFIER: string = String.raw`0|[1-9]\d*`
export const NUMERIC_IDENTIFIER_LOOSE: string = String.raw`\d+`
export const NON_NUMERIC_IDENTIFIER: string = String.raw`\d*[a-zA-Z-]${LETTER_DASH_NUMBER}*`
export const MAIN_VERSION: string = String.raw`(${NUMERIC_IDENTIFIER})\.(${NUMERIC_IDENTIFIER})\.(${NUMERIC_IDENTIFIER})`
export const MAIN_VERSION_LOOSE: string = String.raw`(${NUMERIC_IDENTIFIER_LOOSE})\.(${NUMERIC_IDENTIFIER_LOOSE})\.(${NUMERIC_IDENTIFIER_LOOSE})`
export const PRERELEASE_IDENTIFIER: string = `(?:${NON_NUMERIC_IDENTIFIER}|${NUMERIC_IDENTIFIER})`
export const PRERELEASE_IDENTIFIER_LOOSE: string = `(?:${NON_NUMERIC_IDENTIFIER}|${NUMERIC_IDENTIFIER_LOOSE})`
export const PRERELEASE: string = String.raw`(?:-(${PRERELEASE_IDENTIFIER}(?:\.${PRERELEASE_IDENTIFIER})*))`
export const PRERELEASE_LOOSE: string = String.raw`(?:-?(${PRERELEASE_IDENTIFIER_LOOSE}(?:\.${PRERELEASE_IDENTIFIER_LOOSE})*))`
export const BUILD_IDENTIFIER: string = `${LETTER_DASH_NUMBER}+`
export const BUILD: string = String.raw`(?:\+(${BUILD_IDENTIFIER}(?:\.${BUILD_IDENTIFIER})*))`
export const FULL_PLAIN: string = `v?${MAIN_VERSION}${PRERELEASE}?${BUILD}?`
export const LOOSE_PLAIN: string = String.raw`[v=\s]*${MAIN_VERSION_LOOSE}${PRERELEASE_LOOSE}?${BUILD}?`
export const GREATER_LESS_THAN: string = '((?:<|>)?=?)'
export const XRANGE_IDENTIFIER: string = String.raw`${NUMERIC_IDENTIFIER}|x|X|\*`
export const XRANGE_IDENTIFIER_LOOSE: string = String.raw`${NUMERIC_IDENTIFIER_LOOSE}|x|X|\*`
export const XRANGE_PLAIN: string = String.raw`[v=\s]*(${XRANGE_IDENTIFIER})(?:\.(${XRANGE_IDENTIFIER})(?:\.(${XRANGE_IDENTIFIER})(?:${PRERELEASE})?${BUILD}?)?)?`
export const XRANGE_PLAIN_LOOSE: string = String.raw`[v=\s]*(${XRANGE_IDENTIFIER_LOOSE})(?:\.(${XRANGE_IDENTIFIER_LOOSE})(?:\.(${XRANGE_IDENTIFIER_LOOSE})(?:${PRERELEASE_LOOSE})?${BUILD}?)?)?`
export const LONE_TILDE: string = '(?:~>?)'
export const LONE_CARET: string = String.raw`(?:\^)`

export const COERCE_PLAIN: string = String.raw`(^|[^\d])(\d{1,${MAX_SAFE_COMPONENT_LENGTH}})(?:\.(\d{1,${MAX_SAFE_COMPONENT_LENGTH}}))?(?:\.(\d{1,${MAX_SAFE_COMPONENT_LENGTH}}))?`
export const COERCE: string = String.raw`${COERCE_PLAIN}(?:$|[^\d])`
export const COERCE_FULL: string = String.raw`${COERCE_PLAIN}(?:${PRERELEASE})?(?:${BUILD})?(?:$|[^\d])`

export function makeSafeRegexSource(source: string): string {
  const replacements: readonly (readonly [string, number])[] = [
    [String.raw`\s`, 1],
    [String.raw`\d`, MAX_LENGTH],
    [LETTER_DASH_NUMBER, MAX_SAFE_BUILD_LENGTH],
  ]

  for (const [token, maximum] of replacements) {
    source = source
      .split(`${token}*`)
      .join(`${token}{0,${maximum}}`)
      .split(`${token}+`)
      .join(`${token}{1,${maximum}}`)
  }
  return source
}

export function safeRegex(source: string, flags?: string): RegExp {
  return new RegExp(makeSafeRegexSource(source), flags)
}
