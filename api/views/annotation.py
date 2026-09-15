from django.db import connection
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

# Maps the frontend species identifier (SPECIES_OPTIONS[].file in
# frontend/lib/pages/annotation.tsx) to the gene_annotation_{suffix} table
# suffix in the "dendrobium" database. This whitelist is the only source
# used to build a table name, so a species value that isn't a key here is
# rejected before it can ever reach a SQL string.
SPECIES_TABLE_MAP = {
    "DChaoPraya": "dchaoprayasmile",
    "Daphylium": "daphylium",
    "Dbullenianum": "dbullenianum",
    "Dcariniferum": "dcariniferum",
    "Dcatenatum": "dcatenatum",
    "Dchrysotoxum": "dchrysotoxum",
    "Dcrumenatum": "dcrumenatum",
    "Dcrocatum": "dcrocatum",
    "Ddevonianum": "ddevonianum",
    "Ddiscolor": "ddiscolor",
    "Dellipsophyllum": "dellipsophyllum",
    "Dexile": "dexile",
    "Dformosum": "dformosum",
    "Dhercoglossum": "dhercoglossum",
    "Dhuoshanense": "dhuoshanense",
    "Djenkinsii": "djenkinsii",
    "Dleonis": "dleonis",
    "Dlindleyi": "dlindleyi",
    "Dnobile": "dnobile",
    "Dparcum": "dparcum",
    "Dporphyrochilum": "dporphyrochilum",
    "Dsecundum": "dsecundum",
    "Dsmilliae": "dsmilliae",
    "Dspatella": "dspatella",
    "Dtetragonum": "dtetragonum",
    "Dthyrsiflorum": "dthyrsiflorum",
}

# (db column, display header) pairs, in the order they should be returned -
# mirrors the headers previously shipped in the static species_tables JSON.
COLUMN_HEADERS = [
    ("gene_id", "Gene ID"),
    ("preferred_name", "Preferred Name"),
    ("cog", "COG"),
    ("description", "Description"),
    ("go_terms", "GO terms"),
    ("kegg_ko", "KEGG KO"),
    ("kegg_pathway", "KEGG Pathway"),
    ("pfam", "Pfam"),
    ("ec", "EC"),
]
COLUMN_ORDER = [col for col, _header in COLUMN_HEADERS]
HEADERS = [header for _col, header in COLUMN_HEADERS]


class GeneAnnotationEndpoint(APIView):
    permission_classes = (IsAuthenticated,)

    def get(self, request):
        species = request.GET.get("species", "").strip()
        table_suffix = SPECIES_TABLE_MAP.get(species)

        if not table_suffix:
            return Response(
                {"error": "Unknown species"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        table_name = f"gene_annotation_{table_suffix}"
        columns_sql = ", ".join(COLUMN_ORDER)

        with connection.cursor() as cursor:
            cursor.execute(f"SELECT {columns_sql} FROM {table_name} ORDER BY gene_id")
            rows = cursor.fetchall()

        result_rows = [
            ["" if value is None else str(value) for value in row] for row in rows
        ]

        return Response(
            {"headers": HEADERS, "rows": result_rows},
            status=status.HTTP_200_OK,
        )
