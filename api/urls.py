from django.urls import re_path
from rest_framework.authtoken.views import obtain_auth_token
from .views.subscribers import SubscribersEndpoint
from .views.publications import (
    PublicationsEndpoint,
    PublicationsQueryEndpoint,
    PaginatedPublicationsQueryEndpoint,
    PaginatedPublicationsEndpoint,
    PublicationEndpoint,
)


from .views.orthogroups import OrthogroupsEndpoint, OrthogroupFastaDownloadEndpoint
from .views.gene_trees import GeneTreeListEndpoint, GeneTreeDetailEndpoint
from .views.diff_gene_analysis import DifferentialExpressionAnalysisEndpoint

urlpatterns = [
    re_path(r"^subscribers/$", SubscribersEndpoint.as_view()),
    re_path(r"^publications/p/$", PaginatedPublicationsEndpoint.as_view()),
    re_path(r"^publications/filter/$", PublicationsQueryEndpoint.as_view()),
    re_path(r"^publications/p/filter/$", PaginatedPublicationsQueryEndpoint.as_view()),
    re_path(r"^publications/(?P<slug>[\w\-]+)/$", PublicationEndpoint.as_view()),
    re_path(r"^publications/$", PublicationsEndpoint.as_view()),
    re_path(r"^orthogroups/$", OrthogroupsEndpoint.as_view()),
    re_path(
        r"^orthogroups/(?P<orthogroup_id>OG\d+)/download/$",
        OrthogroupFastaDownloadEndpoint.as_view(),
    ),
    re_path(r"^gene-trees/$", GeneTreeListEndpoint.as_view()),
    re_path(r"^gene-trees/(?P<tree_id>OG\d+)/$", GeneTreeDetailEndpoint.as_view()),
    re_path(r"^authenticate/$", obtain_auth_token),
    re_path(
        r"^differential-expression/$",
        DifferentialExpressionAnalysisEndpoint.as_view(),
        name="differential_expression",
    ),
]
