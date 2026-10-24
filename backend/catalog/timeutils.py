from django.utils import timezone


def local_now():
    """Current time in Asia/Dhaka (settings.TIME_ZONE). Tests patch this."""
    return timezone.localtime()
