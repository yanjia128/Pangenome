import os
import re
from django.core.cache import cache
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated

GENE_TREES_DIR = "/home/user/Orchid/Pangenome/rst/Results_Nov26/Gene_Trees"

# Only allow filenames like OG0000000_tree.txt
VALID_FILENAME_RE = re.compile(r"^OG\d+_tree\.txt$")

GENE_TREE_FILENAMES_CACHE_KEY = "gene_tree_filenames"


def _list_gene_tree_filenames():
    return sorted(f for f in os.listdir(GENE_TREES_DIR) if f.endswith("_tree.txt"))


class GeneTreeListEndpoint(APIView):
    permission_classes = (IsAuthenticated,)

    def get(self, request):
        """List available gene tree files with optional search/pagination."""
        page = int(request.GET.get("page", 1))
        page_size = int(request.GET.get("page_size", 50))
        search = request.GET.get("search", "").strip()

        try:
            all_files = cache.get_or_set(
                GENE_TREE_FILENAMES_CACHE_KEY, _list_gene_tree_filenames, timeout=None
            )
        except FileNotFoundError:
            return Response(
                {"error": "Gene trees directory not found"},
                status=status.HTTP_404_NOT_FOUND,
            )

        if search:
            all_files = [f for f in all_files if search.lower() in f.lower()]

        total = len(all_files)
        start = (page - 1) * page_size
        end = start + page_size
        page_files = all_files[start:end]

        results = [
            {"id": f.replace("_tree.txt", ""), "filename": f} for f in page_files
        ]

        return Response(
            {
                "count": total,
                "page": page,
                "page_size": page_size,
                "results": results,
            },
            status=status.HTTP_200_OK,
        )


class GeneTreeDetailEndpoint(APIView):
    permission_classes = (IsAuthenticated,)

    def get(self, request, tree_id):
        """Return the Newick content for a specific gene tree."""
        filename = f"{tree_id}_tree.txt"

        if not VALID_FILENAME_RE.match(filename):
            return Response(
                {"error": "Invalid tree ID"}, status=status.HTTP_400_BAD_REQUEST
            )

        filepath = os.path.join(GENE_TREES_DIR, filename)

        if not os.path.isfile(filepath):
            return Response(
                {"error": "Tree not found"}, status=status.HTTP_404_NOT_FOUND
            )

        def _read_newick():
            with open(filepath, "r") as f:
                return f.read().strip()

        newick = cache.get_or_set(f"gene_tree_{tree_id}", _read_newick, timeout=None)

        return Response(
            {
                "id": tree_id,
                "newick": newick,
            },
            status=status.HTTP_200_OK,
        )
