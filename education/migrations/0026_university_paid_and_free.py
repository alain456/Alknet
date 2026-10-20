from django.db import migrations, models


def fill_program_fee_mode(apps, schema_editor):
    Campaign = apps.get_model('education', 'AdmissionCampaign')
    Fee = apps.get_model('education', 'EducationFee')
    pending = Campaign.objects.filter(program__isnull=False).exclude(fee_mode__in=['PAYANT', 'GRATUIT'])
    for campaign in pending:
        fee = Fee.objects.filter(campaign_id=campaign.id).order_by('-amount_bif').first()
        if fee is None:
            fee = Fee.objects.filter(
                business_id=campaign.business_id,
                program_id=campaign.program_id,
                academic_year__iexact=campaign.academic_year,
            ).order_by('-amount_bif').first()
        campaign.fee_mode = 'PAYANT' if fee and int(fee.amount_bif or 0) > 0 else 'GRATUIT'
        campaign.save(update_fields=['fee_mode'])


class Migration(migrations.Migration):

    dependencies = [
        ('education', '0025_application_profile_details'),
    ]

    operations = [
        migrations.RunPython(fill_program_fee_mode, migrations.RunPython.noop),
        migrations.RemoveConstraint(
            model_name='admissioncampaign',
            name='uniq_education_campaign_year',
        ),
        migrations.AddConstraint(
            model_name='admissioncampaign',
            constraint=models.UniqueConstraint(
                condition=models.Q(program__isnull=False) & ~models.Q(fee_mode=''),
                fields=('program', 'academic_year', 'fee_mode'),
                name='uniq_education_program_year_mode',
            ),
        ),
        migrations.AlterField(
            model_name='admissioncampaign',
            name='fee_mode',
            field=models.CharField(
                blank=True,
                choices=[('PAYANT', 'Payante'), ('GRATUIT', 'Gratuite')],
                default='',
                help_text='Une inscription payante et une gratuite peuvent coexister pour la même année (école) ou le même programme (université).',
                max_length=16,
            ),
        ),
    ]
