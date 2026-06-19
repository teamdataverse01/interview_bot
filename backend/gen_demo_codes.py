"""Generate single-use demo access codes for student demos.

    python gen_demo_codes.py [count] [note]
    python gen_demo_codes.py 30 "Unilag demo, June"

Each printed code lets exactly ONE person run ONE interview session, then locks.
Hand them out (one per student). List/track usage at GET /admin/demo-codes.
"""

from __future__ import annotations

import sys

from app import repository as repo


def main() -> int:
    count = int(sys.argv[1]) if len(sys.argv) > 1 else 20
    note = sys.argv[2] if len(sys.argv) > 2 else ""
    codes = repo.generate_demo_codes(count, note)
    print(f"Generated {len(codes)} single-use demo codes" + (f" ({note})" if note else "") + ":\n")
    for c in codes:
        print("  " + c)
    print("\nShare one code per student. Each is good for exactly one interview session.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
