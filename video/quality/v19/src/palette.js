// The film's colour system.
//
// Brand tokens are lifted straight from the elder UI (app/src/main/java/com/yinling/hotline/Ui.kt)
// so the film and the product are the same object seen from two angles. The
// surrounding space (backdrop, floor, glass) is the film's own, tuned darker
// than the product so the phone screen is always the brightest thing on screen.
//
// Rule inherited from the product: only brand / attention / good are allowed to
// emit. Body text and subtitles never bloom.

export const C = {
  // Product tokens — must stay in sync with Ui.kt
  brand: 0x1a7f6b,
  brandDeep: 0x12604f,
  attention: 0xc46a14,
  problem: 0xc0392b,
  good: 0x1e8449,
  bone: 0xf6f7f8,
  ink: 0x17202a,

  // Film-only space
  backdrop: 0x0e1418,
  backdropDeep: 0x080c10,
  floor: 0x0b1116,
  glass: 0xdfe8ee,
  gold: 0xe2bd6b,
  text: 0xf2f4f5,
  textDim: 0x9aa6ad,
  textFaint: 0x5c686f,
}

/** Hex int -> normalised RGB triple. */
export function rgb(hex) {
  return [((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255]
}

/** Hex int -> `#rrggbb` string, for canvas 2D. */
export function css(hex, alpha = 1) {
  const r = (hex >> 16) & 255
  const g = (hex >> 8) & 255
  const b = hex & 255
  return alpha >= 1 ? `rgb(${r},${g},${b})` : `rgba(${r},${g},${b},${alpha})`
}

/**
 * Emission strength for a hue, in units the bloom pass will actually notice.
 * Everything visible-but-quiet sits under 0.85 so only deliberate signals halo.
 */
export const EMIT = {
  quiet: 0.18,
  normal: 0.45,
  bright: 1.0,
  signal: 2.2,
}
