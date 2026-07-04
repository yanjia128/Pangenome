from django.http import FileResponse, Http404, HttpResponseNotModified
from django.utils.http import http_date, parse_http_date_safe
from pathlib import Path

BINARY_EXTENSIONS = {
    ".gz",
    ".tbi",
    ".bai",
    ".csi",
    ".fai",
    ".2bit",
    ".bed",
    ".bb",
    ".bw",
    ".cram",
    ".crai",
}


def _is_binary(path: str) -> bool:
    return any(path.endswith(ext) for ext in BINARY_EXTENSIONS)


def serve_jbrowse(request, path, document_root):
    """
    Serve JBrowse static files with correct headers for genomics formats.

    Fixes two problems with Django's default ``serve``:
    1. ``.vcf.gz`` / ``.gff.gz`` / ``.pif.gz`` get ``Content-Encoding: gzip``
       which makes browsers auto-decompress — breaking tabix random access.
    2. No ``Accept-Ranges: bytes`` for Range-request support.
    """
    document_root = Path(document_root).resolve()
    path = Path(path)

    if ".." in path.parts:
        raise Http404

    fullpath = (document_root / path).resolve()

    if not str(fullpath).startswith(str(document_root)):
        raise Http404
    if not fullpath.is_file():
        raise Http404

    statobj = fullpath.stat()

    if_modified_since = request.META.get("HTTP_IF_MODIFIED_SINCE")
    if if_modified_since:
        mtime = statobj.st_mtime
        if_modified_since_ts = parse_http_date_safe(if_modified_since)
        if if_modified_since_ts and int(mtime) <= if_modified_since_ts:
            return HttpResponseNotModified()

    content_type = "application/octet-stream" if _is_binary(str(fullpath)) else None

    response = FileResponse(
        open(fullpath, "rb"),
        content_type=content_type,
    )

    response["Last-Modified"] = http_date(statobj.st_mtime)
    response["Content-Length"] = statobj.st_size
    response["Accept-Ranges"] = "bytes"

    if _is_binary(str(fullpath)):
        del_headers = ["Content-Encoding"]
        for h in del_headers:
            if h in response:
                del response[h]

    return response
