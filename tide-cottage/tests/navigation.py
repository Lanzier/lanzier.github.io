"""Run with npm test after npm install, pip install playwright, and python -m playwright install chromium."""
import argparse
import json
import os
from pathlib import Path
import subprocess
import tempfile

from playwright.sync_api import sync_playwright


def main():
    tests = Path(__file__).resolve().parent
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--node-modules", type=Path, default=tests.parent / "node_modules")
    parser.add_argument("--channel", help="Use an installed browser such as chrome")
    args = parser.parse_args()
    modules = args.node_modules.resolve()
    with tempfile.TemporaryDirectory() as directory, sync_playwright() as runtime:
        tmp = Path(directory)
        subprocess.run([
            "node", "-e",
            "require('esbuild').buildSync({entryPoints:[process.argv[1]],bundle:true,"
            "nodePaths:[process.env.NODE_PATH],outfile:process.argv[2]})",
            str(tests / "navigation.js"), str(tmp / "navigation.js"),
        ], env={**os.environ, "NODE_PATH": str(modules)}, check=True)
        html = tmp / "index.html"
        html.write_text('<!doctype html><script src="navigation.js"></script>', encoding="utf-8")
        browser = runtime.chromium.launch(channel=args.channel)
        try:
            for case in ["dailyActivities", "doorClearance", "furnitureChanges"]:
                page = browser.new_page()
                page.goto(html.as_uri())
                result = page.evaluate("name => window.navigationTests[name]()", case)
                print(f"PASS {case} {json.dumps(result, ensure_ascii=False)}", flush=True)
                page.close()
        finally:
            browser.close()


if __name__ == "__main__":
    main()
