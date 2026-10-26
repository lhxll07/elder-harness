import argparse
import subprocess
from html.parser import HTMLParser
from pathlib import Path


class SlideText(HTMLParser):
    def __init__(self):
        super().__init__()
        self.collecting = False
        self.fragments = []

    def handle_starttag(self, tag, attrs):
        if tag == "article":
            self.collecting = True

    def handle_endtag(self, tag):
        if tag == "article":
            self.collecting = False

    def handle_data(self, data):
        if self.collecting:
            self.fragments.append(data)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("pages", nargs="*", type=int, default=[2, 3, 4, 5, 7, 8])
    arguments = parser.parse_args()
    directory = Path(__file__).resolve().parent
    for page in arguments.pages:
        page_name = f"p{page:02}"
        document = SlideText()
        document.feed((directory / f"{page_name}.html").read_text())
        characters = "".join(sorted(set("".join(document.fragments))))
        text_path = directory / f"assets/fonts/{page_name}-unified-characters.txt"
        text_path.write_text(characters)
        for weight, source in [("regular", "Regular"), ("bold", "Bold")]:
            output_path = directory / f"assets/fonts/{page_name}-unified-sc-{weight}.otf"
            subprocess.run(
                [
                    "pyftsubset",
                    f"/usr/share/fonts/noto-cjk/NotoSansCJK-{source}.ttc",
                    "--font-number=2",
                    f"--text-file={text_path}",
                    f"--output-file={output_path}",
                    "--layout-features=*",
                    "--glyph-names",
                    "--symbol-cmap",
                    "--legacy-cmap",
                    "--notdef-glyph",
                    "--notdef-outline",
                    "--recommended-glyphs",
                ],
                check=True,
            )
        print(f"{page_name}: generated both offline font subsets")


if __name__ == "__main__":
    main()
