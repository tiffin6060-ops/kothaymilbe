import math

from rest_framework import exceptions
from rest_framework.views import exception_handler


def _flatten(detail):
    if isinstance(detail, dict):
        return [msg for value in detail.values() for msg in _flatten(value)]
    if isinstance(detail, list):
        return [msg for value in detail for msg in _flatten(value)]
    return [str(detail)]


def api_exception_handler(exc, context):
    """Every API error has the same shape: {"detail": first message, "errors": [all messages]}.

    Validation errors also keep the per-field structure under "fields".
    """
    if isinstance(exc, exceptions.ParseError):
        exc = exceptions.ParseError("অনুরোধটি সঠিক JSON নয়।")
    elif isinstance(exc, exceptions.UnsupportedMediaType):
        exc = exceptions.UnsupportedMediaType(exc.detail, "Content-Type অবশ্যই application/json হতে হবে।")
    elif isinstance(exc, exceptions.MethodNotAllowed):
        exc = exceptions.MethodNotAllowed("", "এই পদ্ধতিটি অনুমোদিত নয়।")
    elif isinstance(exc, exceptions.Throttled):
        wait = exc.wait
        minutes = max(1, math.ceil((wait or 60) / 60))
        # Passing wait to the constructor would append DRF's English "Expected available in…" sentence.
        exc = exceptions.Throttled(detail=f"অনেকবার চেষ্টা করা হয়েছে। {minutes} মিনিট পরে আবার চেষ্টা করুন।")
        exc.wait = wait  # still sent as the Retry-After header

    response = exception_handler(exc, context)
    if response is None:
        return None

    messages = _flatten(response.data)
    data = {"detail": messages[0] if messages else "", "errors": messages}
    if isinstance(exc, exceptions.ValidationError) and isinstance(exc.detail, dict):
        data["fields"] = response.data
    response.data = data
    return response
