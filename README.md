# storybook-helper

A reading app for children's books translated into colloquial Hong Kong Cantonese.
Live at **https://wz-storybook-helper.web.app**

The books are *made* in [cloud-claude](https://github.com/WandLZhang/cloud-claude): photograph a
page, get Cantonese, correct it, let its nightly job finalize and QA the result. That is a chat app,
and reading a book in it means scrolling a conversation. This is the other half — the paper book
open in front of you, a child beside you, the phone in your other hand.

The two apps share a backend and nothing else. This one **only reads**.

## What it does

- **Shelf** — every finalized book as a cover tile, most recently opened first.
- **Reader** — the page photo tucked in a corner so you can confirm you are on the right page, and
  the Cantonese filling everything else at the largest size that fits. Swipe anywhere on the right
  half of the screen for the next page, left half for the previous, or jump with the thumbnail strip
  along the bottom.
- **普 / 粵** — books translated from English or from written Chinese also store a Mandarin line;
  the toggle swaps the page between the two. It is absent on Cantonese-only books.
- **Tap any character** for its jyutping and English gloss.
- The screen stays awake while a book is open.

Both Chinese fonts draw their romanization *above* each character —
[canto.hk VF-Canto](https://canto.hk) for jyutping, Hanzi-Pinyin for pinyin — so no romanization is
ever written into the text itself.

## Reading it right

Two things here are less obvious than they look, and both are ported rather than reinvented:

**Text sizing.** Page length swings from one line to a dense paragraph, and because the font draws
jyutping above every glyph a line is roughly three times its nominal height. `FitText` binary-searches
the font size against the box on every page change, with a floor below which it scrolls instead —
unreadably small is worse than scrolling.

**The dictionary reading.** About 14% of headwords in the shared CC-CEDICT + CC-Canto blob carry
pinyin but no jyutping (佛珠, 曱甴). Falling back to pinyin silently prints a *Mandarin* reading,
tone-coloured and indistinguishable from the real thing. `dict.ts` uses three tiers instead: the
word's own jyutping, else composed per character (佛 fat6 + 珠 zyu1, which closes about 65% of the
gap), else the Mandarin reading **explicitly labelled as Mandarin**.

## Running it

```bash
cp src/services/firebase.config.example.ts src/services/firebase.config.ts   # fill in from the console
npm install
npm run dev
```

`firebase.config.ts` is gitignored: the Firebase web apiKey is an `AIza*` string and this repo is
public. It is publishable by design — the data behind it is gated by Firestore rules — but it stays
out of the tree by convention.

The fonts are not committed either (VF-Canto alone is 16.6 MB). Drop
`VF-Canto-HKEdB.woff2` and `Hanzi-Pinyin-Font.top.woff2` into `public/fonts/`.

```bash
npm run build
npx firebase deploy --only hosting:wz-storybook-helper
```

## Access

Google sign-in, then Firestore's existing `chats/{userId}` rules do the rest: you see your own books
and nobody else's. The app has no write path at all — `books.ts` exports read functions only, and
`setDoc`/`updateDoc`/`addDoc`/`deleteDoc` do not appear in the built bundle, because nothing imports
them. Last-opened ordering lives in `localStorage` to keep that true.

## Stack

Vite · React · TypeScript · Tailwind · Framer Motion · Firebase (Auth + Firestore + Hosting).
