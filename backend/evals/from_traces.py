"""Turns real requests that went wrong into eval cases, so a failure seen in use is checked on every later change.

    python -m evals.from_traces                       # reads the saved traces from the shared store (Redis settings from .env)
    python -m evals.from_traces --file traces.json    # or a saved copy of /api/admin/traces
The cases are written to evals/cases/from_traces.json for review; they need NOVA_TRACE_CONTENT=on to have been set when the requests ran.
"""
import argparse
import asyncio
import json
import re
import sys
from pathlib import Path

HERE = Path(__file__).parent
TOPIC = re.compile(r"<(?:topic|learning_goal)>(.*?)</(?:topic|learning_goal)>", re.DOTALL)
EXPECTATIONS = re.compile(r"<expectations>(.*?)</expectations>", re.DOTALL)


def cases_from(records: list[dict]) -> list[dict]:
    """One module case per distinct topic and expectations found in the prompts of requests that had a problem."""
    found: dict[tuple[str, str], dict] = {}
    for record in records:
        if not record.get("problem"):
            continue
        for exchange in record.get("exchanges", []):
            topic, expectations = TOPIC.search(exchange["user"]), EXPECTATIONS.search(exchange["user"])
            if topic:
                key = (topic.group(1).strip(), expectations.group(1).strip() if expectations else "")
                found.setdefault(key, {"id": record["request_id"], "topic": key[0], "expectations": key[1], "requires_code": None, "note": "; ".join(record.get("notes", [])) or "request had retries or failures"})
    return list(found.values())


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--file", help="a saved copy of the /api/admin/traces response")
    parser.add_argument("--limit", type=int, default=200)
    parser.add_argument("--out", default=str(HERE / "cases" / "from_traces.json"))
    args = parser.parse_args(argv)
    if args.file:
        records = json.loads(Path(args.file).read_text())["traces"]
    else:
        from dotenv import load_dotenv

        load_dotenv(HERE.parent.parent / ".env")
        import traces

        records = asyncio.run(traces.recent(args.limit, only_problems=True))
    found = cases_from(records)
    Path(args.out).write_text(json.dumps({"modules": found}, indent=2) + "\n")
    print(f"{len(found)} case(s) written to {args.out} from {len(records)} request(s)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
