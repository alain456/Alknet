from django.db import migrations, models


ECOFO_CYCLE_YEARS = {
    'C1': [1, 2],
    'C2': [3, 4],
    'C3': [5, 6],
    'C4': [7, 8, 9],
}


def year_label(year):
    return '1ère année' if int(year) == 1 else f'{year}ème année'


def backfill_ecofo_classes(apps, schema_editor):
    EducationProfile = apps.get_model('education', 'EducationProfile')
    for profile in EducationProfile.objects.all():
        if profile.ecofo_classes:
            continue
        years = []
        seen = set()
        for code in profile.ecofo_cycles or []:
            for year in ECOFO_CYCLE_YEARS.get(str(code), []):
                if year not in seen:
                    seen.add(year)
                    years.append(year)
        if not years and profile.offers_ecofo:
            years = list(range(1, 10))
        profile.ecofo_classes = [
            {'value': str(year), 'label': year_label(year)} for year in years
        ]
        # Normalise aussi les années de section en {value, label}.
        sections = []
        for section in profile.post_fondamental_sections or []:
            if not isinstance(section, dict):
                continue
            row = dict(section)
            raw_years = row.get('classes') or row.get('years') or [1, 2, 3]
            classes = []
            seen_y = set()
            for item in raw_years:
                if isinstance(item, dict):
                    value = str(item.get('value') or '').strip()
                    label = (item.get('label') or '').strip() or (
                        year_label(value) if value.isdigit() else value
                    )
                else:
                    try:
                        value = str(int(item))
                    except (TypeError, ValueError):
                        continue
                    label = year_label(value)
                if not value or value in seen_y:
                    continue
                seen_y.add(value)
                classes.append({'value': value, 'label': label})
            row['classes'] = classes or [
                {'value': str(y), 'label': year_label(y)} for y in (1, 2, 3)
            ]
            row['years'] = [c['value'] for c in row['classes']]
            sections.append(row)
        if sections:
            profile.post_fondamental_sections = sections
        profile.save(update_fields=['ecofo_classes', 'post_fondamental_sections'])


class Migration(migrations.Migration):

    dependencies = [
        ('education', '0016_enrollment_plan_seats'),
    ]

    operations = [
        migrations.AddField(
            model_name='educationprofile',
            name='ecofo_classes',
            field=models.JSONField(
                blank=True,
                default=list,
                help_text='Liste dynamique des classes (ex. 1ère année, 2ème année…).',
                verbose_name='Classes ECOFO',
            ),
        ),
        migrations.RunPython(backfill_ecofo_classes, migrations.RunPython.noop),
    ]
