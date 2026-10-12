from django.contrib import admin

from .models import EducationProfile, EducationProgram, EducationUnit


@admin.register(EducationProfile)
class EducationProfileAdmin(admin.ModelAdmin):
    list_display = (
        'business', 'establishment_type', 'operational_status',
        'publication_status', 'published_at',
    )
    list_filter = (
        'establishment_type', 'operational_status', 'publication_status',
        'has_scholarships', 'has_boarding', 'has_campus',
        'has_evening_courses', 'has_distance_learning',
    )
    search_fields = ('business__name', 'short_description', 'accreditation_number')
    readonly_fields = ('id', 'published_at', 'submitted_at', 'created_at', 'updated_at')
    fieldsets = (
        ('🎓 Identification', {
            'fields': ('business', 'establishment_type', 'operational_status')
        }),
        ('Publication', {
            'fields': ('publication_status', 'submitted_at', 'published_at', 'moderation_note')
        }),
        ('Présentation', {
            'fields': ('short_description', 'history', 'teaching_languages', 'website',
                       'institutional_email')
        }),
        ('Services et agrément', {
            'fields': ('has_scholarships', 'has_boarding', 'has_campus',
                       'has_evening_courses', 'has_distance_learning',
                       'accreditation_number', 'accreditation_body', 'accreditation_valid_until')
        }),
        ('Horodatage', {
            'fields': ('id', 'created_at', 'updated_at')
        }),
    )


@admin.register(EducationUnit)
class EducationUnitAdmin(admin.ModelAdmin):
    list_display = ('business', 'name', 'kind', 'code', 'parent', 'is_active')
    list_filter = ('kind', 'is_active')
    search_fields = ('name', 'code', 'business__name')
    readonly_fields = ('id', 'created_at', 'updated_at')


@admin.register(EducationProgram)
class EducationProgramAdmin(admin.ModelAdmin):
    list_display = (
        'title', 'business', 'unit', 'level', 'degree_awarded',
        'is_active', 'is_public', 'display_order',
    )
    list_filter = ('level', 'is_active', 'is_public', 'domain')
    search_fields = ('title', 'domain', 'business__name')
    readonly_fields = ('id', 'created_at', 'updated_at')
