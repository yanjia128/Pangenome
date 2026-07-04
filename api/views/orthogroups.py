import os
import re

import pandas as pd
from django.core.paginator import Paginator
from django.http import FileResponse
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

ORTHOGROUPS_PATH = (
    "/home/user/Orchid/Pangenome/rst/Results_Nov26/Orthogroups/Orthogroups.tsv"
)
ORTHOGROUP_FASTA_DIR = (
    "/home/user/Orchid/Pangenome/rst/Results_Nov26/Orthogroup_Sequences"
)
VALID_ORTHOGROUP_ID_RE = re.compile(r"^OG\d+$")


class OrthogroupsEndpoint(APIView):
    permission_classes = (IsAuthenticated,)

    def get(self, request):
        page = int(request.GET.get("page", 1))
        page_size = int(request.GET.get("page_size", 20))
        search = request.GET.get("search", "").strip()

        df = pd.read_csv(ORTHOGROUPS_PATH, sep="\t", low_memory=False)
        # Replace NaN values with empty string for JSON compatibility
        df = df.fillna("")
        if search:
            df = df[
                df.apply(
                    lambda row: row.astype(str).str.contains(search, case=False).any(),
                    axis=1,
                )
            ]
        paginator = Paginator(df.to_dict(orient="records"), page_size)
        page_obj = paginator.get_page(page)

        return Response(
            {
                "count": paginator.count,
                "num_pages": paginator.num_pages,
                "results": list(page_obj),
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
