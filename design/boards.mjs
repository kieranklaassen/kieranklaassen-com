// node design/boards.mjs <folder> [http://127.0.0.1:3000]: every page of the running site as a board of a
// design canvas. The words stay words that can be changed on the board; the paint and the sound are the
// site's own, from design/bundle.mjs. Run `npm run build` first, for the style sheet.

import { createRequire } from 'node:module'
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const { chromium } = createRequire(import.meta.url)('playwright')
const to = resolve(process.argv[2])
const site = process.argv[3] ?? 'http://127.0.0.1:3000'
mkdirSync(to, { recursive: true })

const ART = { wide: 'Edge to edge', book: 'Book', around: 'Around the words', river: 'River' }
const THREE = [5, 12, 19].map((x, i) => `M${x} ${i === 1 ? 5.5 : 8}c1.3 1.9 2.8 3.5 2.8 5.5a2.8 2.8 0 0 1-5.6 0c0-2 1.5-3.6 2.8-5.5z`).join('')
const camel = (slug) => slug.replace(/(^|[-_]+)(\w)/g, (_, __, letter) => letter.toUpperCase()).replace(/\W/g, '')
const fonts =
  '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400..800&family=Newsreader:ital,wght@0,200..800;1,200..800&display=swap">'

// ------------------------------------------------------------------------------------ the style sheet

const assets = resolve('public/vite/assets')
const newest = (names) => names.sort((a, b) => statSync(join(assets, b)).mtimeMs - statSync(join(assets, a)).mtimeMs)[0]
const sheet = readFileSync(join(assets, newest(readdirSync(assets).filter((name) => /^application-.*\.css$/.test(name)))), 'utf8')
  .replace(/@font-face\s*\{[^}]*\}/g, '')
  .replaceAll('Newsreader Variable', 'Newsreader')
writeFileSync(join(to, 'site.css'), `${sheet}\n.wc-sound [hidden],.wc-hand[hidden]{display:none!important}\n`)
copyFileSync(resolve('vendor/engine/wasm-device.js'), join(to, 'wasm-device.js'))

// ------------------------------------------------------------------------------------------- the pages

const browser = await chromium.launch({ args: ['--disable-gpu', '--disable-3d-apis'] })
const tab = await browser.newPage({ viewport: { width: 1280, height: 900 } })
await tab.route(/soundcloud|spotify/, (route) => route.abort())

const posts = await (async () => {
  await tab.goto(`${site}/posts?look=rooms&chooser=0`)
  return tab.evaluate(() => JSON.parse(document.querySelector('script[data-page]')?.textContent ?? document.getElementById('app').dataset.page).props.posts.filter((post) => !post.external_url))
})()

const boards = []
const board = (file, title, page, path, tab, more = {}) => boards.push({ file, title, page, path, tab, ...more })

board('Main', 'Home: one long page', { look: 'long', component: 'home' }, '/', 'site')
board('Thoughts', 'Thoughts: the score and the pictures', { look: 'rooms', component: 'posts/index' }, '/posts', 'site')
board('About', 'About', { look: 'rooms', component: 'about' }, '/about', 'site')
board('NotFound', 'A page that is not there', { look: 'rooms', component: 'not_found' }, '/nowhere-at-all', 'site')

const flow = posts.find((post) => post.slug === 'capturing-flow')
for (const art of Object.keys(ART)) board(`Layout${camel(art)}`, art === 'wide' ? `${ART[art]}: chosen` : ART[art], { look: 'rooms', component: 'posts/show', art }, flow.path, 'layouts')
board('HomeName', 'Home: the painted name alone', { look: 'rooms', component: 'home' }, '/', 'homes')
for (const [look, title] of [['estuary', 'Estuary'], ['score', 'Score'], ['mosaic', 'Mosaic'], ['page', 'The page is the painting']]) board(`Kept${camel(look)}`, `Home: ${title}`, { look, component: 'home' }, '/', 'homes')
posts.forEach((post, i) => board(camel(post.slug), post.title, { look: 'rooms', component: 'posts/show', art: 'wide' }, post.path, `articles${1 + Math.floor(i / 6)}`))

board('PhoneHome', 'Home', { look: 'long', component: 'home' }, '/', 'phone', { w: 390 })
board('PhoneThoughts', 'Thoughts', { look: 'rooms', component: 'posts/index' }, '/posts', 'phone', { w: 390 })
board('PhoneWide', 'An article', { look: 'rooms', component: 'posts/show', art: 'wide' }, flow.path, 'phone', { w: 390 })
board('PhoneAbout', 'About', { look: 'rooms', component: 'about' }, '/about', 'phone', { w: 390 })
for (const art of ['book', 'around', 'river']) board(`Phone${camel(art)}`, `${ART[art]}, on a phone`, { look: 'rooms', component: 'posts/show', art }, flow.path, 'layouts', { w: 390 })

const homes = { '/': 'Main', '/posts': 'Thoughts', '/about': 'About', ...Object.fromEntries(posts.map((post) => [post.path, camel(post.slug)])) }
const phones = { '/': 'PhoneHome', '/posts': 'PhoneThoughts', '/about': 'PhoneAbout' }

async function markupOf({ page, path, w }) {
  await tab.goto(`${site}${path}?look=${page.look}&art=${page.art ?? 'wide'}&chooser=0`, { waitUntil: 'load' })
  await tab.waitForSelector('.wc-body > *')
  const links = w ? { ...homes, ...phones } : homes
  return tab.evaluate(([links, three]) => {
    const root = document.querySelector('.wc')
    for (const link of root.querySelectorAll('a[href]')) {
      const href = link.getAttribute('href')
      const own = links[href] ?? links[href.replace(/\/?$/, '/')]
      if (own) link.setAttribute('href', `${own}.dc.html`)
    }
    // what is shown from elsewhere cannot be on a board
    for (const frame of root.querySelectorAll('iframe')) {
      const box = document.createElement('p')
      box.setAttribute('style', 'display: flex; align-items: center; justify-content: center; min-height: 160px; margin: 24px 0; border: 1px solid rgb(31 26 29 / 26%); border-radius: 12px')
      box.textContent = /spotify/.test(frame.src) ? '[The album plays here]' : '[The track plays here]'
      frame.replaceWith(box)
    }
    root.querySelector('.painted-sheet').replaceChildren()
    root.querySelector('.wc-chooser')?.remove()
    const drop = root.querySelector('.wc-sound svg').outerHTML
    const drops = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${three}"></path></svg>`
    root.querySelector('.wc-sound').innerHTML =
      ['music', 'weather', 'paint'].map((part) => `<button type="button" class="wc-part" data-sound="${part}" aria-pressed="true" hidden><span>${part[0].toUpperCase()}${part.slice(1)}</span></button>`).join('') +
      `<button type="button" class="wc-more" data-sound="more" aria-expanded="false" aria-label="Music, weather and paint" hidden>${drops}</button>` +
      `<button type="button" data-sound="all" aria-pressed="false">${drop}<span>Sound</span></button>`
    const play = root.querySelector('.wc-buttons button')
    if (play) {
      play.innerHTML = `${play.querySelector('svg').outerHTML}<span>Play the score</span>`
      root.querySelector('.wc-staff').insertAdjacentHTML('afterbegin', '<i class="wc-hand" aria-hidden="true" hidden></i>')
    }
    root.removeAttribute('data-painted')
    root.removeAttribute('data-art')
    for (const element of root.querySelectorAll('[data-of]')) if (element.dataset.of === '') element.removeAttribute('data-of')
    return root.innerHTML.replace(/<!--.*?-->/g, '')
  }, [links, THREE])
}

const escaped = (text) => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll("'", '&#39;')

const sizes = existsSync(join(to, '../sizes.json')) ? JSON.parse(readFileSync(join(to, '../sizes.json'), 'utf8')) : {}

for (const one of boards) {
  const { file, title, page, path, w = 1280 } = one
  const inner = (await markupOf(one)).replaceAll('{{', '{&#8288;{').replaceAll('}}', '}&#8288;}')
  const h = Math.min(8000, sizes[file] ?? 4000)
  const props = {
    ...(page.art ? { layout: { editor: 'enum', options: Object.values(ART), default: ART[page.art], section: 'Article' } } : {}),
    painting: { editor: 'int', min: 1, max: 999, default: 7, section: 'Paint' },
    $preview: { width: w, height: h },
  }
  writeFileSync(
    join(to, `${file}.dc.html`),
    `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${escaped(title)}</title>
<script src="./support.js"></script>
<link rel="stylesheet" href="site.css">
<script src="watercolor.js"></script>
</head>
<body>
<x-dc>
<helmet>
${fonts}
<style>
body{margin:0}
</style>
</helmet>
<div ref="{{root}}" class="wc"${page.art ? ' data-art="{{art}}"' : ''}>
${inner}
</div>
</x-dc>
<script type="text/x-dc" data-dc-script data-props='${escaped(JSON.stringify(props))}'>
const ART = { 'Edge to edge': 'wide', 'Book': 'book', 'Around the words': 'around', 'River': 'river' };
class Component extends DCLogic {
constructor(props) { super(props); this.root = React.createRef(); }
page() {
const p = this.props;
return { look: '${page.look}', component: '${page.component}', ${page.art ? `art: ART[p.layout ?? '${ART[page.art]}'], ` : ''}url: '${path}', seed: p.painting ?? 7 };
}
componentDidMount() { this.lay(); }
componentDidUpdate() { if (JSON.stringify(this.page()) !== this.laid) this.lay(); }
componentWillUnmount() { if (this.paper) this.paper.stop(); }
lay() {
if (this.paper) this.paper.stop();
this.laid = JSON.stringify(this.page());
if (window.Watercolor && this.root.current) this.paper = window.Watercolor.mount(this.root.current, this.page());
}
renderVals() { return { root: this.root${page.art ? ', art: this.page().art' : ''} }; }
}
</script>
</body>
</html>
`,
  )
}
await browser.close()

// ------------------------------------------------------------------------------------------ the canvas

const pages = [
  ['site', 'Website'],
  ['articles1', 'Articles, newest'],
  ['articles2', 'Articles, middle'],
  ['articles3', 'Articles, oldest'],
  ['phone', 'Phone'],
  ['layouts', 'Kept: article layouts'],
  ['homes', 'Kept: other homes'],
]
const notes = {}
const placed = {}
for (const [id, name] of pages) {
  let x = 0
  let right = 0
  for (const one of boards.filter((one) => one.tab === id)) {
    const w = one.w ?? 1280
    placed[`${one.file}.dc.html`] = { x, y: 0, w, h: Math.min(8000, sizes[one.file] ?? 4000), title: one.title, page: id, expand: 'fill', is_interactive: true }
    x += w + 80
    right = x - 80
  }
  notes[`title-${id}`] = { x: 0, y: -340, text: { site: 'The website', layouts: 'One article, laid out four ways', homes: 'The other directions, as a home page', phone: 'On a phone' }[id] ?? name, kind: 'title1', maxW: right, page: id }
}
notes.how = { x: -440, y: 0, w: 360, page: 'site', fill: 'green', text: 'Press Play on a page. The sound comes in with the first click or tap, and Sound off at its bottom right is remembered: Music, Weather and Paint can each be turned off too. Move the pointer over the paint, throw paint on bare paper, scroll. On Thoughts, press Play the score.' }
notes.which = { x: -440, y: 0, w: 360, page: 'layouts', fill: 'orange', text: 'Edge to edge is the one: every article is laid out in it. The other three are kept here, and under Tweaks every article has Layout, so any of them can be tried in any. Painting, beside it, paints another one.' }
notes.homes = { x: -440, y: 0, w: 360, page: 'homes', fill: 'orange', text: 'The one long page is the home. These are kept, each as a home page, and the name, the score, the estuary and the mosaic live on in the pages of the website.' }

const kept = existsSync(join(to, 'canvas.json')) ? JSON.parse(readFileSync(join(to, 'canvas.json'), 'utf8')) : {}
writeFileSync(
  join(to, 'canvas.json'),
  JSON.stringify(
    { v: 3, createdOnFiles: kept.createdOnFiles ?? { v: 1, at: new Date().toISOString() }, title: 'Watercolor website', launch: { view: 'canvas', page: 'site' }, pages: pages.map(([id, name]) => ({ id, name })), boards: placed, order: boards.map((one) => `${one.file}.dc.html`), notes, designSystems: [] },
    null,
    1,
  ),
)
console.log(boards.length, 'boards')
