from django.core import signing
from django.core.exceptions import ValidationError
from django.http import JsonResponse
from django.views.decorators.cache import never_cache
from django.views.decorators.csrf import csrf_protect
from django.views.decorators.http import require_POST
from wagtail.admin.auth import require_admin_access
from wagtail.blocks import Block

from .data import MAX_JSON_LENGTH
from .quiet import QUIET_SALT, quiet_html


@require_admin_access
@require_POST
@csrf_protect
@never_cache
def quiet_cell(request):
    try:
        # CSRF processing can already have consumed the multipart stream.
        # Inspect its declared size without trying to read request.body again.
        if int(request.META.get("CONTENT_LENGTH") or 0) > MAX_JSON_LENGTH:
            return JsonResponse({"error": "Cell content is too large."}, status=413)
        key = signing.loads(request.POST.get("definition", ""), salt=QUIET_SALT)
        block = Block.definition_registry.get(key)
        prefix = request.POST.get("prefix", "")
        if block is None or not prefix or len(prefix) > 500:
            return JsonResponse({"error": "Unknown cell definition."}, status=400)
        # Native field encoding includes Draftail and nested StreamBlock state.
        # Do not clean(): an incomplete draft can still have a quiet state.
        native = block.value_from_datadict(request.POST, request.FILES, prefix)
    except (
        signing.BadSignature,
        ValidationError,
        TypeError,
        ValueError,
        KeyError,
        AttributeError,
    ):
        return JsonResponse({"error": "Unsupported cell content."}, status=400)
    return JsonResponse({"html": quiet_html(block, native, request)})
