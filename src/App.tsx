import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import type { User } from 'firebase/auth'
import { signIn, signOutNow, watchAuth } from './services/firebase'
import { listBooks, loadBook, markOpened } from './services/books'
import type { Book, Page } from './services/books'
import { Reader } from './components/Reader'

const SPRING = { type: 'spring' as const, stiffness: 400, damping: 34 }

export default function App() {
  const [user, setUser] = useState<User | null | undefined>(undefined)
  const [books, setBooks] = useState<Book[] | null>(null)
  const [open, setOpen] = useState<{ book: Book; title: string; pages: Page[] } | null>(null)
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState('')

  useEffect(() => watchAuth(setUser), [])

  useEffect(() => {
    if (!user) return
    listBooks(user.uid)
      .then(setBooks)
      .catch((e) => setError(String(e)))
  }, [user])

  async function openBook(book: Book) {
    if (!user) return
    setLoading(book.id)
    try {
      const { title, pages } = await loadBook(user.uid, book.id)
      markOpened(book.id)   // so it sits at the top of the shelf next time
      setOpen({ book, title, pages })
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(null)
    }
  }

  // Coming back from a book: re-sort so the one just read is first, and start at the top of the
  // shelf rather than wherever the grid happened to be scrolled.
  function closeBook() {
    setOpen(null)
    setBooks((prev) => (prev ? [...prev] : prev))
    if (user) listBooks(user.uid).then(setBooks).catch(() => {})
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  if (user === undefined) return <Splash>…</Splash>

  if (!user) {
    return (
      <Splash>
        <div className="mb-8 text-center">
          <div className="mb-2 text-5xl">📖</div>
          <div className="text-lg text-neutral-300">Storybook</div>
        </div>
        <motion.button
          whileTap={{ scale: 0.94 }}
          onClick={() => signIn().catch((e) => setError(String(e)))}
          className="rounded-2xl bg-white px-6 py-3 font-medium text-black"
        >
          Sign in with Google
        </motion.button>
        {error && <div className="mt-6 max-w-sm text-center text-sm text-red-400">{error}</div>}
      </Splash>
    )
  }

  // Shelf and reader live inside one AnimatePresence so opening a book animates the way closing
  // one already did — the shelf sinks back and the reader rises over it, rather than a hard swap.
  return (
    <AnimatePresence mode="popLayout" initial={false}>
      {open ? (
        <motion.div
          key="reader"
          initial={{ opacity: 0, scale: 1.04, y: 24 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 1.02, y: 16 }}
          transition={SPRING}
        >
          <Reader
            title={open.title}
            pages={open.pages}
            hasMandarin={open.book.hasMandarin}
            onBack={closeBook}
          />
        </motion.div>
      ) : (
        <motion.div
          key="shelf"
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.96 }}
          transition={SPRING}
          className="min-h-full bg-[#0a0a0b] text-white"
        >
      <div className="flex items-center justify-between px-5 pb-3 pt-[max(1.25rem,env(safe-area-inset-top))]">
        <h1 className="text-2xl font-semibold tracking-tight">Storybook</h1>
        <button onClick={() => signOutNow()} className="text-xs text-neutral-600 active:text-neutral-400">
          sign out
        </button>
      </div>

      {error && <div className="mx-5 mb-3 rounded-xl bg-red-500/10 p-3 text-sm text-red-400">{error}</div>}

      {!books && <div className="px-5 text-neutral-500">Loading your books…</div>}
      {books && !books.length && (
        <div className="px-5 text-neutral-500">No finalized books yet.</div>
      )}

      <div className="grid grid-cols-2 gap-3 px-4 pb-10 sm:grid-cols-3 lg:grid-cols-4">
        <AnimatePresence>
          {books?.map((b, n) => (
            <motion.button
              key={b.id}
              layout
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...SPRING, delay: Math.min(n * 0.025, 0.3) }}
              whileTap={{ scale: 0.95 }}
              onClick={() => openBook(b)}
              className="relative aspect-[3/4] overflow-hidden rounded-2xl border border-white/10 bg-neutral-900 text-left"
            >
              {b.coverUrl && (
                <img src={b.coverUrl} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
              )}
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/95 via-black/70 to-transparent p-3 pt-10">
                <div className="line-clamp-2 text-sm font-medium leading-tight">{b.title}</div>
                <div className="mt-0.5 text-[11px] text-neutral-400">{b.pageCount} pages</div>
              </div>
              {loading === b.id && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/60 text-sm">opening…</div>
              )}
            </motion.button>
          ))}
        </AnimatePresence>
      </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function Splash({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full flex-col items-center justify-center bg-[#0a0a0b] p-6 text-neutral-400">
      {children}
    </div>
  )
}
