/**
 * Tap-a-word lookup against the public CC-CEDICT + CC-Canto blob (~230k headwords, CORS open),
 * the same one subtitle-everything, lockscreen-translate and chinese-convo-live use.
 *
 * The font already prints jyutping above every character, so what this actually buys is the English
 * gloss and a word-level reading — which is why the reading must be RIGHT.
 *
 * About 14% of headwords carry pinyin but NO jyutping (佛珠, 曱甴). Falling back to `py` silently —
 * which convo-live's dict.ts still does — prints the Mandarin reading, tone-coloured and completely
 * indistinguishable from jyutping. This ports the three-tier version from lockscreen-translate
 * (render.html composeReading/readingYue), also live in subtitle-everything as Dict.readingFor:
 *
 *   1. the word's own jyutping
 *   2. otherwise compose it per character (佛 fat6 + 珠 zyu1) — closes 65% of the gap
 *   3. otherwise the Mandarin reading, explicitly LABELLED as Mandarin
 */
const DICT_URL = 'https://storage.googleapis.com/wz-canto-dict/canto-dict.min.json'
const MAX_WORD = 6 // forward-maximum-match window

interface RawEntry {
  d: string[]
  jy: string
  py: string
}
type Dict = Record<string, RawEntry[]>

export interface Reading {
  syllables: { text: string; tone: number }[]
  /** true when tier 3 fired: this is pinyin, not jyutping, and the UI must say so. */
  isMandarinFallback: boolean
  composed: boolean
}

export interface Lookup {
  word: string
  reading: Reading
  def: string
}

let dictPromise: Promise<Dict> | null = null

/** ~7 MB, fetched once on the first tap of a session and kept in memory. */
export function loadDict(): Promise<Dict> {
  if (!dictPromise) {
    dictPromise = fetch(DICT_URL)
      .then((r) => r.json())
      .then((j) => (j.entries ?? {}) as Dict)
      .catch((err) => {
        dictPromise = null // let the next tap retry
        throw err
      })
  }
  return dictPromise
}

/** Charcode range check — no regex, and it has to cover Ext A for characters like 䒐䒏. */
export function isCjk(ch: string): boolean {
  const c = ch.codePointAt(0) ?? 0
  return (c >= 0x3400 && c <= 0x9fff) || (c >= 0xf900 && c <= 0xfaff)
}

function toneOf(syllable: string): number {
  const last = syllable.charCodeAt(syllable.length - 1) - 48
  return last >= 1 && last <= 6 ? last : 0
}

/** Tier 2: glue together each character's own reading. Bail if any character is unknown. */
function composeReading(word: string, dict: Dict, key: 'jy' | 'py'): string {
  const out: string[] = []
  for (const ch of word) {
    const v = (dict[ch]?.[0]?.[key] || '').trim()
    if (!v) return ''
    out.push(v.split(/\s+/)[0]) // one character is one syllable
  }
  return out.join(' ')
}

function readingYue(word: string, e: RawEntry, dict: Dict): Reading {
  const mk = (src: string, extra: Partial<Reading>): Reading => ({
    syllables: src.split(/\s+/).filter(Boolean).map((s) => ({ text: s, tone: toneOf(s) })),
    isMandarinFallback: false,
    composed: false,
    ...extra,
  })
  const jy = (e.jy || '').trim()
  if (jy) return mk(jy, {})
  const composedJy = composeReading(word, dict, 'jy')
  if (composedJy) return mk(composedJy, { composed: true })
  return mk((e.py || '').trim(), { isMandarinFallback: true })
}

/**
 * Longest dictionary word starting at `i`. Returns null when nothing matches, which is normal —
 * the caller just leaves that character untapped.
 */
export async function lookupAt(sentence: string, i: number): Promise<Lookup | null> {
  const dict = await loadDict()
  const maxK = Math.min(MAX_WORD, sentence.length - i)
  for (let k = maxK; k >= 1; k--) {
    const word = sentence.slice(i, i + k)
    const arr = dict[word]
    if (arr?.length) {
      const e = arr[0]
      return {
        word,
        reading: readingYue(word, e, dict),
        def: (e.d || []).slice(0, 3).join('; '),
      }
    }
  }
  return null
}

/** Jyutping tone colours, matching the other apps so the same tone reads the same everywhere. */
export const TONE_COLORS: Record<number, string> = {
  0: '#9ca3af',
  1: '#f87171',
  2: '#fb923c',
  3: '#facc15',
  4: '#4ade80',
  5: '#38bdf8',
  6: '#a78bfa',
}
