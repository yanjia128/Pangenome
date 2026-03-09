import pandas as pd
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from django.core.paginator import Paginator

ORTHOGROUPS_PATH = '/home/user/Orchid/Pangenome/rst/Results_Nov26/Orthogroups/Orthogroups.tsv'

class OrthogroupsEndpoint(APIView):
    permission_classes = (IsAuthenticated,)

    def get(self, request):
        page = int(request.GET.get('page', 1))
        page_size = int(request.GET.get('page_size', 20))
        search = request.GET.get('search', '').strip()

        df = pd.read_csv(ORTHOGROUPS_PATH, sep='\t', low_memory=False)
        # Replace NaN values with empty string for JSON compatibility
        df = df.fillna('')
        if search:
            df = df[df.apply(lambda row: row.astype(str).str.contains(search, case=False).any(), axis=1)]
        paginator = Paginator(df.to_dict(orient='records'), page_size)
        page_obj = paginator.get_page(page)

        return Response({
            'count': paginator.count,
            'num_pages': paginator.num_pages,
            'results': list(page_obj),
        }, status=status.HTTP_200_OK)
