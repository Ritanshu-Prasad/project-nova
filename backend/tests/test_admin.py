import asyncio
import re

import pytest

import admin
import usage

MODEL = "nvidia/Nemotron-3_5-Lightning"
TOKEN = "s3cret-token"


def run(coro):
    return asyncio.run(coro)


@pytest.fixture
def client(monkeypatch):
    from fastapi import FastAPI
    from fastapi.testclient import TestClient

    monkeypatch.setenv("NOVA_ADMIN_TOKEN", TOKEN)
    app = FastAPI()
    app.include_router(admin.router)
    return TestClient(app)


def auth(token=TOKEN) -> dict:
    return {"Authorization": f"Bearer {token}"}


def call(kind="lesson", prompt=1000, completion=200, seconds=2.0):
    run(usage.record_call(kind, MODEL, {"prompt_tokens": prompt, "completion_tokens": completion}, seconds))


ROUTES = ["/api/admin/usage", "/api/admin/metrics", "/api/admin/traces", "/admin", "/api"+"/admin"]


# --- Who may look ---

@pytest.mark.parametrize("path", ROUTES)
def test_the_pages_do_not_exist_without_a_configured_token(client, monkeypatch, path):
    monkeypatch.delenv("NOVA_ADMIN_TOKEN")
    assert client.get(path, headers=auth()).status_code == 404


@pytest.mark.parametrize("path", ["/api/admin/usage", "/api/admin/metrics"])
def test_a_wrong_or_missing_token_is_401(client, path):
    assert client.get(path).status_code == 401
    wrong = client.get(path, headers=auth("nope"))
    assert wrong.status_code == 401 and wrong.headers["www-authenticate"] == "Bearer"


def test_an_empty_token_is_not_accepted(client):
    assert client.get("/api/admin/usage", headers={"Authorization": "Bearer "}).status_code == 401


def test_the_token_is_compared_in_constant_time(client, monkeypatch):
    seen = []
    real = admin.hmac.compare_digest
    monkeypatch.setattr(admin.hmac, "compare_digest", lambda a, b: seen.append((a, b)) or real(a, b))
    client.get("/api/admin/usage", headers=auth("nope"))
    assert seen == [(b"nope", TOKEN.encode())]


def test_the_right_token_is_accepted(client):
    assert client.get("/api/admin/usage", headers=auth()).status_code == 200


# --- The usage report ---

def test_the_report_lists_models_price_budget_and_days(client, monkeypatch):
    monkeypatch.setenv("NOVA_DAILY_TOKEN_BUDGET", "5000")
    call("lesson", 1000, 200)
    report = client.get("/api/admin/usage?days=3", headers=auth()).json()
    assert report["models"]["generate"] == MODEL and report["price_per_million"] == {"input_per_million": 0.06, "output_per_million": 0.24}
    assert report["budget"] == {"daily_token_limit": 5000, "used_today": 1200} and len(report["days"]) == 3
    assert report["days"][0]["kinds"]["lesson"]["calls"] == 1 and report["days"][0]["totals"]["prompt_tokens"] == 1000


def test_without_a_budget_the_report_says_so(client):
    assert client.get("/api/admin/usage", headers=auth()).json()["budget"] == {"daily_token_limit": None, "used_today": 0}


def test_the_number_of_days_is_limited(client):
    assert client.get("/api/admin/usage?days=0", headers=auth()).status_code == 422
    assert client.get("/api/admin/usage?days=91", headers=auth()).status_code == 422
    assert client.get("/api/admin/usage?days=90", headers=auth()).status_code == 200


def test_both_models_are_read_when_they_differ(client, monkeypatch):
    monkeypatch.setenv("NOVA_ALLOWED_MODELS", "tutor/model")
    monkeypatch.setenv("NOVA_TUTOR_MODEL", "tutor/model")
    run(usage.record_call("tutor", "tutor/model", {"prompt_tokens": 7, "completion_tokens": 3}, 1.0))
    assert client.get("/api/admin/usage", headers=auth()).json()["days"][0]["kinds"]["tutor"]["calls"] == 1


# --- Prometheus text ---

def metrics(client) -> str:
    response = client.get("/api/admin/metrics", headers=auth())
    assert response.status_code == 200 and response.headers["content-type"].startswith("text/plain")
    return response.text


def test_metrics_have_help_and_type_lines_and_valid_samples(client):
    call("lesson"), call("quiz", seconds=20)
    for line in metrics(client).strip().splitlines():
        assert line.startswith("# HELP ") or line.startswith("# TYPE ") or re.match(r'^[a-z_]+(\{[^}]*\})? -?[0-9.]+$', line), line


def test_metrics_carry_the_days_numbers(client):
    call("lesson", 1000, 200)
    text = metrics(client)
    assert 'nova_model_calls_today{kind="lesson"} 1' in text
    assert 'nova_model_tokens_today{kind="lesson",type="prompt"} 1000' in text and 'nova_model_tokens_today{kind="lesson",type="completion"} 200' in text
    assert 'nova_model_cost_usd_today{kind="lesson"} 0.000108' in text


def test_the_latency_histogram_is_cumulative(client):
    for seconds in (0.5, 2.0, 8.0, 100.0):
        call("lesson", seconds=seconds)
    text = metrics(client)
    for edge, count in (("1", 1), ("3", 2), ("10", 3), ("30", 3), ("+Inf", 4)):
        assert f'nova_model_latency_seconds_bucket{{kind="lesson",le="{edge}"}} {count}' in text
    assert 'nova_model_latency_seconds_count{kind="lesson"} 4' in text and 'nova_model_latency_seconds_sum{kind="lesson"} 110.5' in text


def test_metrics_include_events_and_the_budget(client, monkeypatch):
    monkeypatch.setenv("NOVA_DAILY_TOKEN_BUDGET", "1000")
    run(usage.record_event("cache:course:hit"))
    call("lesson", 300, 100)
    text = metrics(client)
    assert 'nova_events_today{event="cache:course:hit"} 1' in text
    assert "nova_budget_tokens_used 400" in text and "nova_budget_tokens_limit 1000" in text


def test_an_empty_day_still_gives_valid_metrics(client):
    text = metrics(client)
    assert "# TYPE nova_model_calls_today gauge" in text and "nova_budget_tokens_limit 0" in text


def test_kinds_with_spaces_are_quoted_labels(client):
    call("module quiz")
    assert 'nova_model_calls_today{kind="module quiz"} 1' in metrics(client)


# --- The page ---

def test_the_page_is_served_with_the_token_configured(client):
    page = client.get("/admin")
    assert page.status_code == 200 and "Model usage" in page.text and "sessionStorage" in page.text


def test_the_page_never_puts_the_token_in_a_url(client):
    assert "?token=" not in client.get("/admin").text and "Authorization" in client.get("/admin").text


@pytest.mark.parametrize("path", ["/admin", "/api/admin"])
def test_the_page_is_served_at_both_paths(client, path):
    assert client.get(path).status_code == 200 and "Model usage" in client.get(path).text


def test_the_page_explains_a_wrong_host_and_an_unreachable_backend(client):
    page = client.get("/api/admin").text
    assert "Could not reach the backend" in page and "not the NOVA backend" in page


# --- Models of the pipeline ---

def test_the_report_prices_each_models_calls_at_that_models_price(client, monkeypatch):
    monkeypatch.delenv("NOVA_PLAN_MODEL", raising=False)
    run(usage.record_call("outline", "deepseek-ai/DeepSeek-V4-Flash-0731", {"prompt_tokens": 1_000_000, "completion_tokens": 0}, 1.0))
    call("lesson", 1_000_000, 0)
    report = client.get("/api/admin/usage", headers=auth()).json()
    kinds = report["days"][0]["kinds"]
    assert kinds["outline"]["cost_usd"] == pytest.approx(0.14) and kinds["lesson"]["cost_usd"] == pytest.approx(0.06)
    assert report["price_per_million_by_model"]["deepseek-ai/DeepSeek-V4-Flash-0731"] == {"input_per_million": 0.14, "output_per_million": 0.28}
    assert set(report["price_per_million_by_model"]) == {"deepseek-ai/DeepSeek-V4-Flash-0731", "nvidia/Nemotron-3_5-Lightning"}
