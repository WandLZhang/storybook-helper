/**
 * The only thing in this app that touches Firestore, and it only reads.
 *
 * Books are made in cloud-claude and live in its data model: a book is a conversation carrying a
 * `finalize` record (written by the nightly book_qa job), and a page is an assistant message with a
 * `pageIndex`, bound to its photo by `replyTo`. Nothing here writes, and no write helper is
 * exported, so the reader cannot modify a book even by accident.
 */
import { collection, doc, getDoc, getDocs, orderBy, query } from 'firebase/firestore'
import { db } from './firebase'

export interface Book {
  id: string
  title: string
  pageCount: number
  coverUrl: string | null
  finalizedAt: number
  updatedAt: number
  hasMandarin: boolean
}

/**
 * When a book was last opened, newest first.
 *
 * Kept in localStorage rather than Firestore so this app stays strictly read-only, and merged with
 * the `updatedAt` cloud-claude already bumps when you open a conversation there — so a book you
 * were just working on in either app surfaces at the top of the shelf.
 */
const OPENED_KEY = 'storybook.lastOpened'

export function readOpened(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(OPENED_KEY) || '{}')
  } catch {
    return {}
  }
}

export function markOpened(bookId: string) {
  const all = readOpened()
  all[bookId] = Date.now()
  localStorage.setItem(OPENED_KEY, JSON.stringify(all))
}

export interface Page {
  index: number
  photoUrl: string | null
  yue: string          // Cantonese, HTML stripped to plain text
  cmn: string          // Mandarin, empty on the Cantonese-only books
}

interface RawMsg {
  role?: string
  content?: string
  pageIndex?: number
  replyTo?: string
  image?: { url?: string }
  timestamp?: { toMillis?: () => number }
}

/** Drop the span wrappers cloud-claude stores; the font, not the markup, does the rendering here. */
function stripTags(s: string): string {
  let out = ''
  let depth = 0
  for (const ch of s) {
    if (ch === '<') depth++
    else if (ch === '>') depth = Math.max(0, depth - 1)
    else if (depth === 0) out += ch
  }
  return out
}

/**
 * Split a stored page into its two halves.
 *
 * Two shapes exist and both are literal, not something to infer: books translated from Chinese are
 * bare Cantonese paragraphs, and books translated from English carry `**Mandarin:**` then
 * `**Cantonese:**` headers.
 */
export function splitPage(content: string): { yue: string; cmn: string } {
  const text = content || ''
  const cantoAt = text.indexOf('**Cantonese:**')
  if (cantoAt < 0) return { yue: stripTags(text).trim(), cmn: '' }
  const mandAt = text.indexOf('**Mandarin:**')
  const cmn = mandAt >= 0 ? text.slice(mandAt + '**Mandarin:**'.length, cantoAt) : ''
  return {
    yue: stripTags(text.slice(cantoAt + '**Cantonese:**'.length)).trim(),
    cmn: stripTags(cmn).trim(),
  }
}

function conversations(uid: string) {
  return collection(db, 'chats', uid, 'conversations')
}

/** Every finalized book, newest first, with page one's photo as the cover. */
export async function listBooks(uid: string): Promise<Book[]> {
  const snap = await getDocs(conversations(uid))
  const out: Book[] = []
  await Promise.all(
    snap.docs.map(async (d) => {
      const data = d.data() as {
        title?: string
        updatedAt?: { toMillis?: () => number }
        finalize?: { pageCount?: number; at?: { toMillis?: () => number } }
      }
      const fin = data.finalize
      if (!fin) return // not a finalized book: chats, drafts, half-shot books
      const msgs = await getDocs(query(collection(d.ref, 'messages'), orderBy('timestamp')))
      const raw = msgs.docs.map((m) => ({ id: m.id, ...(m.data() as RawMsg) }))
      const photos = new Map(raw.filter((m) => m.image?.url).map((m) => [m.id, m.image!.url!]))
      const pages = raw.filter((m) => typeof m.pageIndex === 'number')
      if (!pages.length) return
      pages.sort((a, b) => (a.pageIndex ?? 0) - (b.pageIndex ?? 0))
      const first = pages[0]
      out.push({
        id: d.id,
        title: data.title || 'Untitled',
        pageCount: pages.length,
        coverUrl: (first.replyTo && photos.get(first.replyTo)) || null,
        finalizedAt: fin.at?.toMillis?.() ?? 0,
        updatedAt: data.updatedAt?.toMillis?.() ?? 0,
        hasMandarin: pages.some((p) => (p.content || '').includes('**Cantonese:**')),
      })
    }),
  )
  // Most recently touched first: this app's own opens, then cloud-claude's updatedAt, then the
  // finalize time as the tiebreak for books never opened in either.
  const opened = readOpened()
  const rank = (b: Book) => Math.max(opened[b.id] ?? 0, b.updatedAt, b.finalizedAt)
  return out.sort((a, b) => rank(b) - rank(a))
}

/** Every page of one book, in page order, each paired with its own photo. */
export async function loadBook(uid: string, bookId: string): Promise<{ title: string; pages: Page[] }> {
  const ref = doc(db, 'chats', uid, 'conversations', bookId)
  const [chat, msgs] = await Promise.all([
    getDoc(ref),
    getDocs(query(collection(ref, 'messages'), orderBy('timestamp'))),
  ])
  const raw = msgs.docs.map((m) => ({ id: m.id, ...(m.data() as RawMsg) }))
  const photos = new Map(raw.filter((m) => m.image?.url).map((m) => [m.id, m.image!.url!]))
  const pages = raw
    .filter((m) => typeof m.pageIndex === 'number')
    .sort((a, b) => (a.pageIndex ?? 0) - (b.pageIndex ?? 0))
    .map((m) => ({
      index: m.pageIndex as number,
      photoUrl: (m.replyTo && photos.get(m.replyTo)) || null,
      ...splitPage(m.content || ''),
    }))
  return { title: (chat.data() as { title?: string } | undefined)?.title || 'Untitled', pages }
}
