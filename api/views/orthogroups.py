import os
import re

from django.core.cache import cache
from django.db import connection
from django.http import FileResponse
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

ORTHOGROUP_TABLE = "orthogroup_26"
ORTHOGROUP_FASTA_DIR = (
    "/home/user/Orchid/Pangenome/rst/Results_Nov26/Orthogroup_Sequences"
)
VALID_ORTHOGROUP_ID_RE = re.compile(r"^OG\d+$")

ORTHOGROUP_COLUMNS_CACHE_KEY = "orthogroup_26_columns"


def _load_orthogroup_columns():
    with connection.cursor() as cursor:
        cursor.execute(f"SELECT * FROM {ORTHOGROUP_TABLE} LIMIT 0")
        return [col.name for col in cursor.description]


class OrthogroupsEndpoint(APIView):
    permission_classes = (IsAuthenticated,)

    def get(self, request):
        page = int(request.GET.get("page", 1))
        page_size = int(request.GET.get("page_size", 20))
        search = request.GET.get("search", "").strip()

        columns = cache.get_or_set(
            ORTHOGROUP_COLUMNS_CACHE_KEY, _load_orthogroup_columns, timeout=None
        )
        columns_sql = ", ".join(columns)

        where_sql = ""
        params = []
        if search:
            like_clauses = " OR ".join(f"{col}::text ILIKE %s" for col in columns)
            where_sql = f"WHERE {like_clauses}"
            params = [f"%{search}%"] * len(columns)

        with connection.cursor() as cursor:
            cursor.execute(
                f"SELECT count(*) FROM {ORTHOGROUP_TABLE} {where_sql}", params
            )
            count = cursor.fetchone()[0]

            offset = (page - 1) * page_size
            cursor.execute(
                f"SELECT {columns_sql} FROM {ORTHOGROUP_TABLE} {where_sql} "
                f"ORDER BY orthogroup LIMIT %s OFFSET %s",
                params + [page_size, offset],
            )
            rows = cursor.fetchall()

        num_pages = max(1, -(-count // page_size)) if page_size else 1
        results = [
            {col: ("" if value is None else value) for col, value in zip(columns, row)}
            for row in rows
        ]

        return Response(
            {
                "count": count,
                "num_pages": num_pages,
                "results": results,
            },
            status=status.HTTP_200_OK,
        )


class OrthogroupFastaDownloadEndpoint(APIView):
    permission_classes = (IsAuthenticated,)

    def get(self, request, orthogroup_id):
        if not VALID_ORTHOGROUP_ID_RE.match(orthogroup_id):
            return Response(
                {"error": "Invalid orthogroup ID"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        filepath = os.path.join(ORTHOGROUP_FASTA_DIR, f"{orthogroup_id}.fa")

        if not os.path.isfile(filepath):
            return Response(
                {"error": "FASTA file not found"},
                status=status.HTTP_404_NOT_FOUND,
            )

        return FileResponse(
            open(filepath, "rb"),
            as_attachment=True,
            filename=f"{orthogroup_id}.fa",
            content_type="application/octet-stream",
        )
