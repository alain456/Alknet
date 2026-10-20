from django.db import migrations, models


def fill_slugs(apps, schema_editor):
    Business = apps.get_model('businesses', 'Business')
    from django.utils.text import slugify

    reserved = {'www', 'api', 'app', 'admin', 'static', 'media', 'mail', 'support', 'localhost'}
    used = set(
        Business.objects.exclude(slug__isnull=True).exclude(slug='').values_list('slug', flat=True)
    )
    for business in Business.objects.filter(models.Q(slug__isnull=True) | models.Q(slug='')).order_by('created_at'):
        base = (slugify(business.name or '')[:70] or 'etablissement')
        if base in reserved:
            base = f'{base}-hub'
        candidate = base
        n = 2
        while candidate in used:
            candidate = f'{base}-{n}'[:80]
            n += 1
        used.add(candidate)
        business.slug = candidate
        business.save(update_fields=['slug'])


class Migration(migrations.Migration):

    dependencies = [
        ('businesses', '0025_employee_faculty_scope'),
    ]

    operations = [
        migrations.AddField(
            model_name='business',
            name='slug',
            field=models.SlugField(
                blank=True, max_length=80, null=True, unique=True,
                help_text='Sous-domaine public, par exemple biu.isokohub.com.',
            ),
        ),
        migrations.RunPython(fill_slugs, migrations.RunPython.noop),
    ]
