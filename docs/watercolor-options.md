# The watercolor, and the options that were not chosen

The site can be painted in several ways. What was chosen and what was kept is
written here, so that nothing has to be made twice.

## Chosen

- **Articles are laid out edge to edge** (`art=wide`, 2026-11-26). The top of
  the page is the painting, from one edge of the window to the other, with bare
  paper left in it for the painted title.
- **The home is one long page** (`look=long`, 2026-11-26): the painted name,
  the score and the estuary. It is the first of `LOOKS` in
  `app/controllers/inertia_controller.rb`, so it is what everyone sees who has
  chosen no look, and they see no list to choose from.
- **The sound is on.** It comes in with the first click or tap, because a
  browser lets nothing sound before that, and nothing of it is fetched before
  that either. Sound off is remembered, by the browser, until Sound is pressed
  again. It does not start at a key press (a screen reader would be talked
  over), where the browser is told to save data, or after a track embedded in
  the page has been started. Music, Weather and Paint can each be turned off.

## Kept

Each of these works as it did. An address with a look or a layout in it sets a
cookie, so the next page has it too, and lists the others at the foot of the
page. `look=long` goes back, and `chooser=0` hides the list.

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
| `long` | **One long page.** The painted name, the score and the estuary, in one. Chosen. |
| `rooms` | **A look for each page.** The name at home, the score on Thoughts, a painting per article, the mosaic on About, the squares on a page that is not there. |
| `name` | **Painted name.** The other way for the home: the name alone, which is also what `rooms` has there. |
| `estuary` | **Estuary.** |
| `score` | **Score.** Every thought is a note, and it can be played. |
| `mosaic` | **Mosaic.** |
| `page` | **The page is the painting.** |
| `blocks` | **The blocks**, the site as it was before. |

`seed=…` paints another painting of the same.

All of them are on the design canvas too, on the pages whose names begin with
"Kept". `design/bundle.mjs` and `design/boards.mjs` make its files.

## If they should go some day

Take the choosers out of `shell.tsx` and `inertia_controller.rb`. Each look and
layout is one function in `watercolor/` and one block of CSS, and only those on
a page are drawn.
