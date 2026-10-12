from django.db import migrations, models


def backfill_open_tracks(apps, schema_editor):
    AdmissionCampaign = apps.get_model('education', 'AdmissionCampaign')
    EducationProfile = apps.get_model('education', 'EducationProfile')
    for campaign in AdmissionCampaign.objects.filter(program__isnull=True):
        profile = EducationProfile.objects.filter(business_id=campaign.business_id).first()
        if not profile:
            continue
        tracks = []
        if profile.offers_prescolaire:
            tracks.append('PRESCOLAIRE')
        if profile.offers_ecofo:
            tracks.append('ECOFO')
        if profile.offers_post_fondamental:
            tracks.append('POST_FONDAMENTAL')
        if tracks:
            campaign.open_tracks = tracks
            campaign.save(update_fields=['open_tracks'])


class Migration(migrations.Migration):

    dependencies = [
        ('education', '0012_boarding_regime_variants'),
    ]

    operations = [
        migrations.AddField(
            model_name='admissioncampaign',
            name='open_tracks',
            field=models.JSONField(
                blank=True,
                default=list,
                help_text='PRESCOLAIRE, ECOFO, POST_FONDAMENTAL — uniquement pour les campagnes école.',
                verbose_name='Parcours ouverts',
            ),
        ),
        migrations.AddField(
            model_name='enrollmentapplication',
            name='track',
            field=models.CharField(
                blank=True,
                choices=[
                    ('PRESCOLAIRE', 'Maternelle / Préscolaire'),
                    ('ECOFO', 'École fondamentale (ECOFO)'),
                    ('POST_FONDAMENTAL', 'Post-fondamental'),
                ],
                default='',
                max_length=32,
            ),
        ),
        migrations.AddField(
            model_name='enrollmentapplication',
            name='ecofo_year',
            field=models.CharField(
                blank=True,
                choices=[('1', '1ère année'), ('OTHER', 'Autre année')],
                default='',
                max_length=16,
                verbose_name='Année ECOFO',
            ),
        ),
        migrations.AddField(
            model_name='enrollmentapplication',
            name='post_section',
            field=models.CharField(
                blank=True, default='', max_length=120, verbose_name='Section post-fondamental',
            ),
        ),
        migrations.AddField(
            model_name='enrollmentapplication',
            name='required_documents',
            field=models.JSONField(blank=True, default=list),
        ),
        migrations.AlterField(
            model_name='admissioncampaign',
            name='required_documents',
            field=models.JSONField(
                blank=True,
                default=list,
                help_text='Université : pièces de la formation. École : pièces locales en plus du catalogue parcours.',
                verbose_name='Pièces de l’année',
            ),
        ),
        migrations.RunPython(backfill_open_tracks, migrations.RunPython.noop),
    ]
