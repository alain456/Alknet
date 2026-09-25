# Generated manually — lab P0–P3

import django.db.models.deletion
import django.utils.timezone
import uuid
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('hospital', '0034_hospital_accounting'),
    ]

    operations = [
        migrations.AddField(
            model_name='hospitalexam',
            name='loinc_code',
            field=models.CharField(
                blank=True,
                default='',
                help_text='Code LOINC (interop FHIR Observation / DiagnosticReport)',
                max_length=32,
            ),
        ),
        migrations.AddField(
            model_name='prescription',
            name='appointment',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='prescriptions',
                to='hospital.appointment',
            ),
        ),
        migrations.AddField(
            model_name='prescription',
            name='hospital_exam',
            field=models.ForeignKey(
                blank=True,
                help_text='Examen du catalogue hospitalier',
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='prescriptions',
                to='hospital.hospitalexam',
            ),
        ),
        migrations.AddField(
            model_name='labresult',
            name='prescription',
            field=models.ForeignKey(
                blank=True,
                help_text='Prescription EXAM à l’origine de la demande',
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='lab_results',
                to='hospital.prescription',
            ),
        ),
        migrations.AddField(
            model_name='labresult',
            name='hospital_exam',
            field=models.ForeignKey(
                blank=True,
                help_text='Examen catalogue (tarif / LOINC)',
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='lab_results',
                to='hospital.hospitalexam',
            ),
        ),
        migrations.AddField(
            model_name='labresult',
            name='validated_by_user',
            field=models.ForeignKey(
                blank=True,
                help_text='Validateur (médecin / biologiste) si hors DoctorProfile',
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='validated_lab_results',
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.AddField(
            model_name='labresult',
            name='invoice',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='lab_results',
                to='hospital.invoice',
            ),
        ),
        migrations.AddField(
            model_name='labresult',
            name='parameters',
            field=models.JSONField(
                blank=True,
                default=list,
                help_text='Paramètres multi-valeurs [{name, value, unit, reference, flag}]',
            ),
        ),
        migrations.AddField(
            model_name='labresult',
            name='document',
            field=models.FileField(
                blank=True,
                help_text='PDF / image du compte-rendu',
                null=True,
                upload_to='hospital/lab/%Y/%m/',
            ),
        ),
        migrations.AddField(
            model_name='labresult',
            name='fhir_resource_type',
            field=models.CharField(blank=True, default='ServiceRequest', max_length=40),
        ),
        migrations.AddField(
            model_name='labresult',
            name='fhir_service_request_id',
            field=models.CharField(blank=True, default='', max_length=64),
        ),
        migrations.AddField(
            model_name='labresult',
            name='fhir_diagnostic_report_id',
            field=models.CharField(blank=True, default='', max_length=64),
        ),
        migrations.AlterField(
            model_name='labresult',
            name='appointment',
            field=models.ForeignKey(
                blank=True,
                help_text='RDV associé (optionnel si créé depuis une prescription)',
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='lab_results',
                to='hospital.appointment',
            ),
        ),
        migrations.AlterField(
            model_name='labresult',
            name='result_value',
            field=models.CharField(
                blank=True,
                default='',
                help_text='Valeur résumé du résultat',
                max_length=500,
            ),
        ),
        migrations.AlterField(
            model_name='labresult',
            name='document_url',
            field=models.URLField(
                blank=True,
                help_text='Lien legacy vers le fichier PDF',
                null=True,
            ),
        ),
        migrations.CreateModel(
            name='LabResultEvent',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('action', models.CharField(max_length=60)),
                ('from_status', models.CharField(blank=True, default='', max_length=30)),
                ('to_status', models.CharField(blank=True, default='', max_length=30)),
                ('note', models.CharField(blank=True, default='', max_length=500)),
                ('details', models.JSONField(blank=True, default=dict)),
                ('created_at', models.DateTimeField(default=django.utils.timezone.now)),
                ('actor', models.ForeignKey(
                    blank=True,
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='lab_result_events',
                    to=settings.AUTH_USER_MODEL,
                )),
                ('lab_result', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='events',
                    to='hospital.labresult',
                )),
            ],
            options={
                'ordering': ['-created_at'],
            },
        ),
    ]
