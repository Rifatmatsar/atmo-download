from html.parser import HTMLParser
from pathlib import Path
import re
import sys

class SiteParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.ids = []
        self.anchors = []
        self.images_without_alt = []
        self.tags = set()

    def handle_starttag(self, tag, attrs):
        values = dict(attrs)
        self.tags.add(tag)
        if values.get("id"):
            self.ids.append(values["id"])
        if tag == "a":
            self.anchors.append(values.get("href", ""))
        if tag == "img" and "alt" not in values:
            self.images_without_alt.append(values.get("src", "(unknown image)"))

def main():
    path = Path("index.html")
    if not path.exists():
        raise SystemExit("index.html is missing")
    html = path.read_text(encoding="utf-8")
    parser = SiteParser()
    parser.feed(html)
    parser.close()

    errors = []
    duplicates = sorted({item for item in parser.ids if parser.ids.count(item) > 1})
    if duplicates:
        errors.append("Duplicate IDs: " + ", ".join(duplicates))
    known_ids = set(parser.ids)
    for href in parser.anchors:
        if not href:
            errors.append("An anchor has no href")
        elif href.startswith("#") and href[1:] not in known_ids:
            errors.append("Broken in-page anchor: " + href)
    if parser.images_without_alt:
        errors.append("Images missing alt text: " + ", ".join(parser.images_without_alt))

    required = [
        '<html lang="tr">',
        '<meta name="viewport"',
        '<meta name="description"',
        '<title>ATMO',
        'id="ozellikler"',
        'id="atmo-ai"',
        'id="gizlilik"',
        'id="indir"',
        'id="sss"',
        "prefers-reduced-motion",
        "https://github.com/Rifatmatsar/atmo-download/releases/latest/download/ATMO.apk",
        "Yeni ATMO AI geliştirmeleri test sürecindedir",
    ]
    for needle in required:
        if needle not in html:
            errors.append("Missing required content: " + needle)

    if not re.search(r"@media\s*\(max-width:\s*\d+px\)", html):
        errors.append("Responsive mobile breakpoint not found")

    if errors:
        print("ATMO site validation failed:")
        for error in errors:
            print(" - " + error)
        return 1

    print(f"ATMO site validation passed: {len(parser.tags)} HTML elements, {len(parser.ids)} IDs, {len(parser.anchors)} links.")
    return 0

if __name__ == "__main__":
    sys.exit(main())
