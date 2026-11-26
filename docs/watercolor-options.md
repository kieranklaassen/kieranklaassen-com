# The watercolor, and the options that were not chosen

The site can be painted in several ways. What was chosen and what was kept is
written here, so that nothing has to be made twice.

## Chosen

- **Articles are laid out edge to edge** (`art=wide`, 2026-11-26). The top of
  the page is the painting, from one edge of the window to the other, with bare
  paper left in it for the painted title.
- **The sound is on.** It comes in with the first click or tap, because a
  browser lets nothing sound before that, and nothing of it is fetched before
  that either. Sound off is remembered, by the browser, until Sound is pressed
  again. It does not start at a key press (a screen reader would be talked
  over), where the browser is told to save data, or after a track embedded in
  the page has been started. Music, Weather and Paint can each be turned off.

## Still to be chosen

- **The home page**: one long page (`look=long`) or the painted name alone
  (`look=rooms`). The other pages are the same under both.
- The site is **as it was** (`look=blocks`) for whoever has chosen no look, so
  nothing of this is seen on the site until that default is changed: it is the
  first of `LOOKS` in `app/controllers/inertia_controller.rb`.

## Kept

Each of these works as it did. An address with a look or a layout in it sets a
cookie, so the next page has it too; `look=blocks` goes back, and `chooser=0`
hides the list at the foot of the page.

Article layouts (`/posts/…?look=rooms&art=…`, painted in
`app/frontend/watercolor/article.ts`, styled in `app/frontend/looks/article.css`):

| `art` | What it is |
| --- | --- |
| `wide` | **Edge to edge.** Chosen. |
| `book` | **Book.** A plate over the title, a painted initial, a vignette over every heading. |
| `around` | **Around the words.** The title from edge to edge, and pieces of the painting in both margins. |
| `river` | **River.** The words run between two banks in the color of the piece, with details for islands. |

Looks of the whole site (`/?look=…`, painted in
`app/frontend/watercolor/compose.ts`):

| `look` | What it is |
| --- | --- |
| `long` | **One long page.** The painted name, the score and the estuary, in one. |
| `rooms` | **A look for each page.** The name at home, the score on Thoughts, a painting per article, the mosaic on About, the squares on a page that is not there. |
| `name` | **Painted name.** |
| `estuary` | **Estuary.** |
| `score` | **Score.** Every thought is a note, and it can be played. |
| `mosaic` | **Mosaic.** |
| `page` | **The page is the painting.** |
| `blocks` | **As it is.** |

`seed=…` paints another painting of the same.

All of them are on the design canvas too, on the pages whose names begin with
"Kept". `design/bundle.mjs` and `design/boards.mjs` make its files.

## When the home page is chosen

Change the first of `LOOKS`, take the chooser out of `shell.tsx`, and leave the
other looks and layouts where they are, or cut them: each is one function in
`watercolor/` and one block of CSS, and only those on a page are drawn.
