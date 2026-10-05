# Pulse: Live World Blog

A live, multi-topic blog that runs entirely on GitHub. No server and no database.

**Live site:** https://YOUR-USERNAME.github.io/pulse-blog/

## What it does
- Shows live stories from BBC's public RSS feeds: world, sports, movies and TV, tech, science, business
- Category tabs and a search box
- Profiles (username only), likes and saved stories, stored in the visitor's browser
- Editor's picks, written by the site owner

## How it works
| Part | Job |
|------|-----|
| GitHub Pages | Hosts the website files in `docs/` and gives the public link |
| GitHub Actions | Runs `scripts/fetch_news.py` about every 15 minutes and saves the latest stories to `docs/data/news.json` |
| The browser | Runs all the logic in `docs/script.js`; profiles, likes and saves are kept in `localStorage` |

## Project structure
```
docs/                    the website
  index.html, script.js, style.css
  data/news.json         live stories (updated by the bot)
  data/posts.json        editor's picks
scripts/fetch_news.py    fetches the BBC feeds
.github/workflows/       the scheduled job (update-news.yml)
```

## Limits
- News refreshes about every 15 minutes, not every second.
- Profiles have no passwords and live only in one browser, so likes and saves do not sync between devices.

## Customize
- Site name: the `<title>` and the title button in `docs/index.html`
- Colors: CSS variables at the top of `docs/style.css`
- News sources: the `FEEDS` list in `scripts/fetch_news.py`
- Add an editor's pick: add an entry to `docs/data/posts.json`

## Run it locally
Open a terminal in the `docs` folder and run `python -m http.server`, then visit http://localhost:8000.
