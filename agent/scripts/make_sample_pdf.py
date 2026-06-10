"""Generate sample.pdf at the repo root for demo and E2E walkthrough."""
from pathlib import Path

import fitz

TEXT = """Photosynthesis

Plants use sunlight to produce food. This process is called photosynthesis.
It occurs mainly in the leaves, where chlorophyll captures light energy
and converts carbon dioxide and water into glucose and oxygen.

Key concepts:
- Chlorophyll is the green pigment in leaves.
- Sunlight provides the energy for the reaction.
- Oxygen is released as a byproduct.
"""


def main() -> None:
    repo_root = Path(__file__).resolve().parent.parent.parent
    out_path = repo_root / "sample.pdf"
    doc = fitz.open()
    page = doc.new_page()
    page.insert_text((50, 72), TEXT, fontsize=11)
    doc.save(out_path)
    doc.close()
    print(f"Wrote {out_path}")


if __name__ == "__main__":
    main()
