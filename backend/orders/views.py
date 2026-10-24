from rest_framework import status
from rest_framework.exceptions import APIException, NotFound, ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from .serializers import OrderInput, OrderOutput
from .services import find_by_idempotency_key, order_queryset, place_order
from .throttles import OrderRateThrottle


class Conflict(APIException):
    status_code = status.HTTP_409_CONFLICT
    default_detail = "এই Idempotency-Key অন্য একটি অর্ডারে ব্যবহার হয়েছে। নতুন অর্ডারের জন্য নতুন key দিন।"
    default_code = "idempotency_conflict"


def idempotency_key_from(request):
    key = request.headers.get("Idempotency-Key", "").strip()
    if not key:
        raise ValidationError({"idempotency_key": ["Idempotency-Key হেডার দিতে হবে।"]})
    if len(key) > 100:
        raise ValidationError({"idempotency_key": ["Idempotency-Key সর্বোচ্চ ১০০ অক্ষরের হতে পারে।"]})
    return key


class OrderCreate(APIView):
    throttle_classes = [OrderRateThrottle]

    def post(self, request):
        key = idempotency_key_from(request)

        # A retry of an already-placed order returns that order, even if (for example)
        # its slot has closed since. The phone must match so a key alone reveals nothing.
        existing = find_by_idempotency_key(key)
        if existing:
            sent_phone = str(request.data.get("phone", "")) if isinstance(request.data, dict) else ""
            if sent_phone.replace(" ", "").replace("-", "") != existing.phone:
                raise Conflict()
            return Response(OrderOutput(existing).data, status=status.HTTP_200_OK)

        serializer = OrderInput(data=request.data)
        serializer.is_valid(raise_exception=True)
        order, created = place_order(serializer.validated_data, key)
        order = order_queryset().get(pk=order.pk)
        return Response(OrderOutput(order).data, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)


class OrderDetail(APIView):
    def get(self, request, number):
        phone = request.query_params.get("phone", "").strip()
        order = order_queryset().filter(number=number, phone=phone).first() if phone else None
        if order is None:
            raise NotFound("অর্ডার পাওয়া যায়নি। অর্ডার নম্বর ও মোবাইল নম্বর মিলিয়ে দেখুন।")
        return Response(OrderOutput(order).data)
