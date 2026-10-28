from django.core.paginator import EmptyPage

from rest_framework.pagination import PageNumberPagination


class ServicesPageNumberPagination(PageNumberPagination):
    """Pages hors plage → dernière page (pas de 404), pour un annuaire à fort volume."""

    page_size = 24
    page_size_query_param = 'page_size'
    max_page_size = 100

    def paginate_queryset(self, queryset, request, view=None):
        page_size = self.get_page_size(request)
        if not page_size:
            return None

        paginator = self.django_paginator_class(queryset, page_size)
        page_number = request.query_params.get(self.page_query_param, 1)
        if page_number in self.last_page_strings:
            page_number = paginator.num_pages
        try:
            page_number = int(page_number)
        except (TypeError, ValueError):
            page_number = 1
        if page_number < 1:
            page_number = 1
        try:
            self.page = paginator.page(page_number)
        except EmptyPage:
            self.page = paginator.page(1 if paginator.num_pages < 1 else paginator.num_pages)
        if paginator.num_pages > 1 and self.template is not None:
            self.display_page_controls = True
        self.request = request
        return list(self.page)
