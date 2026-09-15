from django.http import FileResponse, Http404, HttpResponseNotModified, StreamingHttpResponse
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


def _parse_range(range_header: str, file_size: int):
    """Parse 'Range: bytes=start-end', return (start, end) or None."""
    if not range_header or not range_header.startswith("bytes="):
        return None
    range_spec = range_header[6:]
    if "-" not in range_spec:
        return None
    start_str, end_str = range_spec.split("-", 1)
    try:
        start = int(start_str) if start_str else 0
        end = int(end_str) if end_str else file_size - 1
    except ValueError:
        return None
    end = min(end, file_size - 1)
    if start > end or start >= file_size:
        return None
    return start, end


def _file_iterator(path, start, length, chunk=65536):
    with open(path, "rb") as f:
        f.seek(start)
        remaining = length
        while remaining > 0:
            data = f.read(min(chunk, remaining))
            if not data:
                break
            remaining -= len(data)
            yield data


def serve_jbrowse(request, path, document_root):
    """
    Serve JBrowse static files with correct headers for genomics formats.

    Fixes three problems with Django's default ``serve``:
    1. ``.vcf.gz`` / ``.gff.gz`` / ``.pif.gz`` get ``Content-Encoding: gzip``
       which makes browsers auto-decompress — breaking tabix random access.
    2. No ``Accept-Ranges: bytes`` for Range-request support.
    3. Range requests not handled — tabix needs 206 Partial Content responses
       to fetch specific BGZF blocks; without this JBrowse throws
       "invalid bgzf header".
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

    file_size = statobj.st_size
    is_bin = _is_binary(str(fullpath))
    content_type = "application/octet-stream" if is_bin else None

    range_header = request.META.get("HTTP_RANGE", "")
    parsed = _parse_range(range_header, file_size)

    if parsed:
        start, end = parsed
        length = end - start + 1
        response = StreamingHttpResponse(
            _file_iterator(fullpath, start, length),
            status=206,
            content_type=content_type or "application/octet-stream",
        )
        response["Content-Range"] = f"bytes {start}-{end}/{file_size}"
        response["Content-Length"] = str(length)
    else:
        response = FileResponse(open(fullpath, "rb"), content_type=content_type)
        response["Content-Length"] = str(file_size)

    response["Last-Modified"] = http_date(statobj.st_mtime)
    response["Accept-Ranges"] = "bytes"

    if is_bin and "Content-Encoding" in response:
        del response["Content-Encoding"]

    return response
