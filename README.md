# Kufu (工夫)

Kufu means ingenuity: finding a better way. It is a very fast new tab page for Chrome with no build step and no dependencies.

## Install
1. Open `chrome://extensions` and turn on **Developer mode**.
2. Click **Load unpacked** and choose this folder. Keep the folder here: Chrome reads it from disk.
3. Open a new tab and press **Esc** for settings.

After editing any file, press the reload icon on the extension's card.

## Keys
`Esc` settings · `Ctrl+K` command palette · `/` search · `Z` hide everything · `Ctrl+Shift+L` dark or light · `Alt+1`–`9` open a link

## Unsplash collections
Get a free Access Key at <https://unsplash.com/oauth/applications>. Then go to Settings › Background › Unsplash, paste the key and
a collection link, and press **Load collection**. Collections made only of Unsplash+ photos can't be used. A new Unsplash app gets 50
requests an hour; loading a collection uses up to 5 per collection and the list is cached.

## Why it's fast
- First paint uses only `localStorage` and synchronous local scripts. Nothing on the network is waited for.
- Settings and optional widgets are separate files that load only when used.
- Favicons come from Chrome's own cache. Weather, sync and tints run after paint. The next photo is preloaded during idle time.

## Landing page
`site/` is the website, deployed with Cloudflare Pages. It is not part of the extension.

## Data and permissions
`storage`, `favicon` and `search` are always on. Bookmarks, tabs, history, most-visited sites and DuckDuckGo
suggestions are requested only when you turn them on. Weather comes from Open-Meteo.

## License
GPL-3.0, see `LICENSE`. Third-party notices are in `licenses/`.

Font: [Sunghyun Sans](https://github.com/anaclumos/sunghyun-sans), SIL OFL 1.1, see `fonts/LICENSE`.
