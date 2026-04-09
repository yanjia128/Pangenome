from django.urls import re_path
from api.views.diff_gene_analysis import DifferentialExpressionAnalysisEndpoint

urlpatterns = [
    re_path(
        r"^differential-expression/$",
        DifferentialExpressionAnalysisEndpoint.as_view(),
        name="differential_expression",
    ),
]
