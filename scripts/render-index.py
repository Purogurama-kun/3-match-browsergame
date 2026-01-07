#!/usr/bin/env python3
from pathlib import Path

from jinja2 import Environment, FileSystemLoader

SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parent
TEMPLATES_DIR = PROJECT_ROOT / "templates"
OUTPUT_FILE = PROJECT_ROOT / "index.html"


def render_index() -> None:
    loader = FileSystemLoader(str(TEMPLATES_DIR))
    env = Environment(loader=loader, autoescape=False)
    template = env.get_template("index.html.jinja")
    output = template.render()
    OUTPUT_FILE.write_text(output, encoding="utf-8")
    print(f"Rendered {OUTPUT_FILE.relative_to(PROJECT_ROOT)}")


if __name__ == "__main__":
    render_index()
