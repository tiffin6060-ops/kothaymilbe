import ipaddress

from rest_framework.throttling import SimpleRateThrottle

# Next.js runs on the same machine and forwards the visitor's IP in X-Client-IP.
TRUSTED_PROXIES = {"127.0.0.1", "::1"}


class OrderRateThrottle(SimpleRateThrottle):
    """Limits order attempts per customer IP (rate: REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"]["orders"])."""

    scope = "orders"

    def get_ident(self, request):
        remote_addr = request.META.get("REMOTE_ADDR", "")
        if remote_addr in TRUSTED_PROXIES:
            client_ip = request.META.get("HTTP_X_CLIENT_IP", "").strip()
            try:
                return str(ipaddress.ip_address(client_ip))
            except ValueError:
                pass
        return remote_addr

    def get_cache_key(self, request, view):
        return self.cache_format % {"scope": self.scope, "ident": self.get_ident(request)}
