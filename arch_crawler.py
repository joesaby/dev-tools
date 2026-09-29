"""
Polite architecture-site crawler for personal design research.
Collects page text (design language), image URLs + captions, and downloads
images that look like plans/elevations/sections.

Setup:  pip install requests beautifulsoup4
Usage:  python arch_crawler.py https://example-architect.com --depth 2 --max-pages 100
Output: results.json and an images/ folder
"""
import argparse, hashlib, json, os, re, time
from collections import deque
from urllib.parse import urljoin, urlparse, urldefrag
from urllib.robotparser import RobotFileParser
import requests
from bs4 import BeautifulSoup

UA = "PersonalHomeResearchBot/1.0 (non-commercial)"
PLAN_WORDS = re.compile(r"plan|elevation|section|layout|floor|site|drawing", re.I)
IMG_EXT = (".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg", ".tif", ".tiff")
MAX_IMG_BYTES = 15 * 1024 * 1024
DESIGN_TERMS = ["courtyard", "nadumuttam", "verandah", "sloped roof", "laterite",
                "jaali", "cross ventilation", "clay tile", "overhang", "thinnai",
                "passive cooling", "monsoon", "exposed brick", "skylight"]

session = requests.Session()
session.headers["User-Agent"] = UA


def load_robots(base):
    rp = RobotFileParser(urljoin(base, "/robots.txt"))
    try:
        # RobotFileParser.read() has no timeout; fetch ourselves
        r = session.get(rp.url, timeout=10)
        rp.parse(r.text.splitlines() if r.ok else [])
        if not r.ok and r.status_code in (401, 403):
            rp.disallow_all = True
        return rp
    except requests.RequestException:
        return None


def allowed(robots, url):
    return robots is None or robots.can_fetch(UA, url)


def first_src(img):
    for attr in ("data-src", "data-lazy-src", "src"):
        if img.get(attr):
            return img[attr]
    srcset = img.get("data-srcset") or img.get("srcset")
    if srcset:  # take the last (largest) candidate
        return srcset.split(",")[-1].split()[0]
    return None


def parse_page(url, html):
    soup = BeautifulSoup(html, "html.parser")
    text = " ".join(soup.get_text(" ").split())
    low = text.lower()
    images = []
    for img in soup.find_all("img"):
        src = first_src(img)
        if not src or src.startswith("data:"):
            continue
        fig = img.find_parent("figure")
        cap = fig.figcaption.get_text(" ", strip=True) if fig and fig.figcaption else ""
        images.append({"url": urljoin(url, src), "alt": img.get("alt", ""), "caption": cap})
    return {
        "url": url,
        "title": soup.title.get_text(strip=True) if soup.title else "",
        "headings": [h.get_text(" ", strip=True) for h in soup.find_all(["h1", "h2", "h3"])],
        "design_terms": [t for t in DESIGN_TERMS if t in low],
        "text": text[:5000],
        "images": images,
    }, soup


def is_plan(img):
    # match filename/alt/caption only, never the domain or directories
    name = os.path.basename(urlparse(img["url"]).path)
    return bool(PLAN_WORDS.search(f"{name} {img['alt']} {img['caption']}"))


def download(img, folder, robots):
    path_part = urlparse(img["url"]).path
    if not path_part.lower().endswith(IMG_EXT) or not allowed(robots, img["url"]):
        return False
    digest = hashlib.sha1(img["url"].encode()).hexdigest()[:8]
    dest = os.path.join(folder, f"{digest}_{os.path.basename(path_part)}")
    if os.path.exists(dest):
        return False
    with session.get(img["url"], timeout=20, stream=True) as r:
        if not r.ok or int(r.headers.get("Content-Length") or 0) > MAX_IMG_BYTES:
            return False
        size = 0
        with open(dest + ".part", "wb") as f:
            for chunk in r.iter_content(65536):
                size += len(chunk)
                if size > MAX_IMG_BYTES:
                    break
                f.write(chunk)
    if size > MAX_IMG_BYTES:
        os.remove(dest + ".part")
        return False
    os.replace(dest + ".part", dest)
    return True


def crawl(start, depth, max_pages, delay, out="."):
    domain = urlparse(start).netloc
    robots = load_robots(start)
    if robots and robots.crawl_delay(UA):
        delay = max(delay, float(robots.crawl_delay(UA)))
    img_dir = os.path.join(out, "images")
    os.makedirs(img_dir, exist_ok=True)
    queue, seen, results, n_img = deque([(start, 0)]), {start}, [], 0
    while queue and len(results) < max_pages:
        url, d = queue.popleft()
        if not allowed(robots, url):
            continue
        try:
            r = session.get(url, timeout=20)
            if "text/html" not in r.headers.get("Content-Type", ""):
                continue
        except requests.RequestException as e:
            print("skip", url, e)
            continue
        page, soup = parse_page(r.url, r.text)
        results.append(page)
        print(f"[{len(results)}] {page['title'][:60]} | terms: {page['design_terms']}")
        for img in filter(is_plan, page["images"]):
            try:
                n_img += download(img, img_dir, robots)
            except (requests.RequestException, OSError) as e:
                print("img skip", img["url"], e)
        if d < depth:
            for a in soup.find_all("a", href=True):
                link = urldefrag(urljoin(r.url, a["href"]))[0]
                # skip non-http, other domains, and query-string URLs (pagination traps)
                if (link not in seen and urlparse(link).netloc == domain
                        and urlparse(link).scheme in ("http", "https")
                        and not urlparse(link).query):
                    seen.add(link)
                    queue.append((link, d + 1))
        time.sleep(delay)
    with open(os.path.join(out, "results.json"), "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)
    print(f"Done: {len(results)} pages, {n_img} plan images -> {out}/results.json, {img_dir}/")


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("start_url")
    p.add_argument("--depth", type=int, default=2)
    p.add_argument("--max-pages", type=int, default=100)
    p.add_argument("--delay", type=float, default=2.0, help="seconds between requests")
    p.add_argument("--out", default=".", help="output directory")
    a = p.parse_args()
    crawl(a.start_url, a.depth, a.max_pages, a.delay, a.out)
