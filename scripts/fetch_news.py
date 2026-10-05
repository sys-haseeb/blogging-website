"""Fetch BBC RSS feeds and write docs/data/news.json. Run by GitHub Actions (standard library only)."""
import html
import json
import os
import re
import sys
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime

FEEDS = {
    "world": "https://feeds.bbci.co.uk/news/world/rss.xml",
    "sports": "https://feeds.bbci.co.uk/sport/rss.xml",
    "entertainment": "https://feeds.bbci.co.uk/news/entertainment_and_arts/rss.xml",
    "technology": "https://feeds.bbci.co.uk/news/technology/rss.xml",
    "science": "https://feeds.bbci.co.uk/news/science_and_environment/rss.xml",
    "business": "https://feeds.bbci.co.uk/news/business/rss.xml",
}
PER_FEED = 30
THUMB_TAG = "{http://search.yahoo.com/mrss/}thumbnail"
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "docs", "data", "news.json")


def fetch_xml(url):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (Pulse class project)"})
    with urllib.request.urlopen(req, timeout=15) as resp:
        return resp.read()


def parse_feed(xml_bytes, category):
    items = []
    for node in ET.fromstring(xml_bytes).iter("item"):
        title = (node.findtext("title") or "").strip()
        link = (node.findtext("link") or "").strip()
        if not title or not link.startswith(("http://", "https://")):
            continue
        summary = re.sub(r"<[^>]+>", "", node.findtext("description") or "")
        try:
            published = parsedate_to_datetime(node.findtext("pubDate")).astimezone(timezone.utc).isoformat()
        except (TypeError, ValueError):
            published = ""
        thumb = node.find(THUMB_TAG)
        image = thumb.get("url", "") if thumb is not None else ""
        if not image.startswith(("http://", "https://")):
            image = ""
        items.append({
            "title": html.unescape(title),
            "summary": html.unescape(summary).strip(),
            "link": link,
            "image": image,
            "published": published,
            "category": category,
            "source": "BBC",
        })
    return items


def main():
    try:
        with open(OUT, encoding="utf-8") as f:
            old = json.load(f).get("items", [])
    except (OSError, ValueError):
        old = []

    items, ok = [], 0
    for category, url in FEEDS.items():
        try:
            items += parse_feed(fetch_xml(url), category)[:PER_FEED]
            ok += 1
        except Exception as err:  # keep the previous stories for a feed that failed
            print(f"warning: {category} failed: {err}", file=sys.stderr)
            items += [i for i in old if i.get("category") == category]

    if ok == 0:
        sys.exit("All feeds failed; keeping the existing news.json.")

    seen, unique = set(), []
    for item in items:
        if item["link"] not in seen:
            seen.add(item["link"])
            unique.append(item)
    unique.sort(key=lambda i: i["published"], reverse=True)

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump({"updated": datetime.now(timezone.utc).isoformat(), "items": unique}, f, ensure_ascii=False)
    print(f"Saved {len(unique)} stories ({ok}/{len(FEEDS)} feeds ok)")


if __name__ == "__main__":
    main()
