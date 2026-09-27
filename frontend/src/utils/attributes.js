// Shared garment-attribute vocabulary: what each option looks like and means.

export const ATTRIBUTE_OPTIONS = {
  neckline: ['mandarin', 'v-neck', 'sweetheart', 'turtleneck', 'open lapel', 'funnel neck', 'shawl collar'],
  sleeves: ['full', 'sleeveless', 'bell', 'three-quarter', 'off-shoulder', 'cap sleeves'],
  fabric: ['heavy cotton twill', 'mulberry silk', 'raw linen', 'cotton velvet', 'merino wool knit', 'chanderi silk', 'organic canvas'],
  color: ['onyx', 'emerald', 'earth tones', 'burgundy', 'ivory', 'sapphire', 'ochre', 'navy', 'rose'],
  fit: ['regular', 'relaxed', 'oversized', 'slim', 'bodycon', 'tailored', 'draped', 'flared'],
};

export const ATTRIBUTE_LABELS = { neckline: 'Neckline', sleeves: 'Sleeves', fabric: 'Fabric', color: 'Color', fit: 'Fit' };

export const COLOR_SWATCHES = {
  onyx: '#141417', emerald: '#10915f', 'earth tones': '#9a6b43', burgundy: '#7d1830',
  ivory: '#f3efe4', sapphire: '#2556c9', ochre: '#d4891f', navy: '#1b2b57', rose: '#e8879f',
  black: '#0d0d0f', white: '#f7f7f5', blush: '#f2b8c6', beige: '#d9c4a3', maroon: '#6b1426',
  mustard: '#d9a51f', teal: '#127c7c', lavender: '#b9a4e8', olive: '#6b7440', charcoal: '#36393f',
  cream: '#f1e6cf', gold: '#caa04a', silver: '#bfc4ca', coral: '#f0775f', plum: '#6d2b5b',
};

// Any value the user can produce — a named swatch, a custom hex, or a CSS color word.
export function swatchFor(value) {
  if (!value) return null;
  const key = String(value).trim().toLowerCase();
  if (COLOR_SWATCHES[key]) return COLOR_SWATCHES[key];
  if (/^#[0-9a-f]{6}$/i.test(key)) return key;
  if (typeof CSS !== 'undefined' && CSS.supports?.('color', key)) return key;
  return null;
}

export function isCustomColor(value) {
  return /^#[0-9a-f]{6}$/i.test(String(value || '').trim());
}

export function colorName(value) {
  return isCustomColor(value) ? `Custom ${String(value).toUpperCase()}` : value;
}

// Luminance check so text/checkmarks sit legibly on any swatch.
export function isLightColor(hex) {
  const match = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex || '');
  if (!match) return false;
  const [r, g, b] = match.slice(1).map((part) => parseInt(part, 16));
  return (0.299 * r + 0.587 * g + 0.114 * b) > 170;
}

// CSS-drawn cloth textures so fabric options read as material, not words.
const FABRIC_TEXTURES = [
  [/twill|denim|gabardine/, 'repeating-linear-gradient(135deg, #6f6a62 0 2px, #57534c 2px 5px)'],
  [/velvet/, 'radial-gradient(120% 90% at 30% 20%, #8a2340, #3e0b1c 70%)'],
  [/silk|satin|chiffon/, 'linear-gradient(115deg, #d9c6b0 0%, #fff7ec 22%, #bda78e 45%, #f4e6d4 68%, #a89276 100%)'],
  [/linen|houndstooth/, 'repeating-linear-gradient(0deg, rgb(255 255 255 / 0.12) 0 1px, transparent 1px 4px), repeating-linear-gradient(90deg, rgb(0 0 0 / 0.12) 0 1px, transparent 1px 4px), #b8a88f'],
  [/knit|wool|merino/, 'repeating-linear-gradient(90deg, rgb(0 0 0 / 0.14) 0 2px, transparent 2px 7px), repeating-linear-gradient(60deg, rgb(255 255 255 / 0.1) 0 3px, transparent 3px 7px), #cfc6b8'],
  [/canvas|cotton/, 'repeating-linear-gradient(0deg, rgb(0 0 0 / 0.1) 0 1px, transparent 1px 3px), repeating-linear-gradient(90deg, rgb(0 0 0 / 0.1) 0 1px, transparent 1px 3px), #cbbfa7'],
];

export function fabricTexture(name) {
  const key = String(name || '').toLowerCase();
  const match = FABRIC_TEXTURES.find(([pattern]) => pattern.test(key));
  return match ? match[1] : 'linear-gradient(135deg, #5d6b78, #2b3440)';
}

export const ATTRIBUTE_NOTES = {
  neckline: {
    mandarin: 'A short stand-up collar that sits close to the neck — clean, formal, no lapels.',
    'v-neck': 'Opens into a V at the front, lengthening the neck and torso.',
    sweetheart: 'Two curves meeting in a dip at the centre, like the top of a heart.',
    turtleneck: 'A tall, folded collar that hugs the full neck.',
    'open lapel': 'Front edges fold back into soft lapels and stay open.',
    'funnel neck': 'A standing collar cut in one with the body, flaring slightly like a funnel.',
    'shawl collar': 'One continuous rounded lapel that wraps from the neck to the front closure.',
  },
  fit: {
    regular: 'Follows the body with standard ease — neither snug nor loose.',
    relaxed: 'Extra room through the chest and waist for an easy drape.',
    oversized: 'Deliberately generous, dropped shoulders and a boxy volume.',
    slim: 'Cut close to the body with minimal ease.',
    bodycon: 'Hugs the body closely from shoulder to hem.',
    tailored: 'Shaped at the waist with structure at the shoulders.',
    draped: 'Fabric falls in soft folds and cascades from the body.',
    flared: 'Fitted at the top, widening into volume toward the hem.',
  },
  sleeves: {
    full: 'Full-length sleeves to the wrist.',
    sleeveless: 'No sleeves — a clean armhole.',
    bell: 'Fitted at the upper arm, flaring wide toward the wrist.',
    'three-quarter': 'Ends between the elbow and the wrist.',
    'off-shoulder': 'Sits below the shoulders, baring them.',
    'cap sleeves': 'A short sleeve that just covers the shoulder cap.',
  },
};
