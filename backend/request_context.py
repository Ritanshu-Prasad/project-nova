from contextvars import ContextVar

# The id of the request being handled, so every log line and saved prompt can be tied back to it.
request_id_var: ContextVar[str] = ContextVar("request_id", default="-")
