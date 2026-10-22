import asyncio
import json

from evals import judge_check


def run(coroutine):
    return asyncio.run(coroutine)


def test_preparing_writes_lessons_with_the_judge_score_and_an_empty_human_score(fake_model, tmp_path, monkeypatch):
    monkeypatch.setattr(judge_check, "LABELS", tmp_path / "labels.json")
    assert run(judge_check.prepare(2)) == 2
    items = json.loads((tmp_path / "labels.json").read_text())["items"]
    assert len(items) == 2 and all(item["human"] is None and item["judge"] == 4.5 and item["lesson"] and item["questions"] for item in items)
    assert len({item["id"] for item in items}) == 2


def test_only_items_with_a_human_score_are_compared(tmp_path):
    path = tmp_path / "labels.json"
    path.write_text(json.dumps({"items": [{"judge": 4.0, "human": 3}, {"judge": 5.0, "human": None}, {"judge": 2.0, "human": 2}]}))
    result = judge_check.compare(path)
    assert result["items"] == 2 and result["bias"] == 0.5


def test_the_command_says_so_when_nothing_is_rated_yet(tmp_path, monkeypatch, capsys):
    path = tmp_path / "labels.json"
    path.write_text(json.dumps({"items": [{"judge": 4.0, "human": None}]}))
    monkeypatch.setattr(judge_check, "LABELS", path)
    assert judge_check.main([]) == 1 and "No item" in capsys.readouterr().out
