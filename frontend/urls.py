from django.urls import re_path
from . import views

urlpatterns = [
    re_path(
        r"^blog$|^blog/(?P<string>.+)$|^jbrowse$|^$", views.spa_and_admin_handler, name="frontend"
    ),
    re_path(r"^.*\.(js|png)$", views.frontend_files_handler, name="frontend"),
]
