# Generated manually with JSON cast fix — 2026-08-20

import datetime
import django.db.models.deletion
import uuid
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('businesses', '0013_businessrole_permissions'),
        ('hospital', '0006_doctorprofile_accepted_payment_methods_and_more'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        # -------------------------------------------------------------------
        # 01.1 — HospitalProfile : fiche identité complète de l'hôpital
        # -------------------------------------------------------------------
        migrations.CreateModel(
            name='HospitalProfile',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('acronym', models.CharField(blank=True, help_text="Sigle de l'établissement (ex: CHU, CHUK, HBB)", max_length=20, null=True)),
                ('hospital_type', models.CharField(choices=[('PUBLIC', 'Public'), ('PRIVATE', 'Privé'), ('FAITH_BASED', 'Confessionnel'), ('NGO', 'ONG / Humanitaire'), ('MILITARY', 'Militaire'), ('OTHER', 'Autre')], default='PRIVATE', max_length=20)),
                ('operational_status', models.CharField(choices=[('ACTIVE', 'En activité'), ('TEMPORARILY_CLOSED', 'Temporairement fermé'), ('UNDER_RENOVATION', 'En rénovation'), ('CLOSED', 'Fermé définitivement')], default='ACTIVE', max_length=30)),
                ('level', models.CharField(choices=[('HEALTH_POST', 'Poste de santé'), ('HEALTH_CENTER', 'Centre de santé'), ('DISTRICT_HOSPITAL', 'Hôpital de district'), ('PROVINCIAL_HOSPITAL', 'Hôpital provincial'), ('NATIONAL_HOSPITAL', 'Hôpital national'), ('SPECIALIZED_HOSPITAL', 'Hôpital spécialisé'), ('CLINIC', 'Clinique privée'), ('POLYCLINIC', 'Polyclinique')], default='CLINIC', max_length=30)),
                ('reference_level', models.CharField(blank=True, choices=[('LEVEL_1', 'Niveau 1 — Soins primaires'), ('LEVEL_2', 'Niveau 2 — Soins secondaires'), ('LEVEL_3', 'Niveau 3 — Soins tertiaires / Spécialisés'), ('LEVEL_4', 'Niveau 4 — Soins quaternaires / Super-spécialisés')], max_length=10, null=True)),
                ('emergency_available', models.BooleanField(default=False)),
                ('emergency_phone', models.CharField(blank=True, max_length=50, null=True)),
                ('opening_hours', models.JSONField(blank=True, default=dict)),
                ('languages_available', models.CharField(default='Français, Kirundi', max_length=300)),
                ('accreditation_number', models.CharField(blank=True, max_length=100, null=True)),
                ('accreditation_body', models.CharField(blank=True, max_length=200, null=True)),
                ('accreditation_valid_until', models.DateField(blank=True, null=True)),
                ('bed_capacity', models.IntegerField(blank=True, null=True)),
                ('icu_beds', models.IntegerField(blank=True, null=True)),
                ('telemedicine_unit_available', models.BooleanField(default=False)),
                ('telemedicine_unit_description', models.TextField(blank=True, null=True)),
                ('accepted_insurances', models.JSONField(blank=True, default=list)),
                ('customer_service_phone', models.CharField(blank=True, max_length=50, null=True)),
                ('customer_service_whatsapp', models.CharField(blank=True, max_length=50, null=True)),
                ('customer_service_email', models.EmailField(blank=True, max_length=254, null=True)),
                ('customer_service_available_24_7', models.BooleanField(default=False)),
                ('cover_image_url', models.URLField(blank=True, null=True)),
                ('gallery_urls', models.JSONField(blank=True, default=list)),
                ('presentation_video_url', models.URLField(blank=True, null=True)),
                ('facebook_url', models.URLField(blank=True, null=True)),
                ('twitter_url', models.URLField(blank=True, null=True)),
                ('linkedin_url', models.URLField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={
                'verbose_name': 'Profil Hôpital',
                'verbose_name_plural': 'Profils Hôpitaux',
                'ordering': ['business__name'],
            },
        ),
        migrations.AddField(
            model_name='hospitalprofile',
            name='business',
            field=models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='hospital_profile', to='businesses.business'),
        ),

        # -------------------------------------------------------------------
        # 01.2 — MedicalService : nouveaux champs
        # -------------------------------------------------------------------
        migrations.AddField(
            model_name='medicalservice',
            name='availability',
            field=models.CharField(choices=[('H24_7', '24h/24 — 7j/7'), ('BUSINESS_HOURS', 'Heures ouvrables uniquement'), ('BY_APPOINTMENT', 'Sur rendez-vous'), ('MORNING_ONLY', 'Matin uniquement'), ('AFTERNOON_ONLY', 'Après-midi uniquement'), ('SPECIFIC_DAYS', 'Jours spécifiques (voir horaires)'), ('TEMPORARILY_UNAVAILABLE', 'Temporairement indisponible')], default='BY_APPOINTMENT', max_length=30),
        ),
        migrations.AddField(
            model_name='medicalservice',
            name='contact_email',
            field=models.EmailField(blank=True, max_length=254, null=True),
        ),
        migrations.AddField(
            model_name='medicalservice',
            name='cost_notes',
            field=models.CharField(blank=True, max_length=300, null=True),
        ),
        migrations.AddField(
            model_name='medicalservice',
            name='currency',
            field=models.CharField(default='BIF', max_length=10),
        ),
        migrations.AddField(
            model_name='medicalservice',
            name='display_order',
            field=models.IntegerField(default=0),
        ),
        migrations.AddField(
            model_name='medicalservice',
            name='service_type',
            field=models.CharField(choices=[('INTERNAL_MEDICINE', 'Médecine interne'), ('GENERAL_SURGERY', 'Chirurgie générale'), ('PEDIATRICS', 'Pédiatrie'), ('OBSTETRICS_GYNECOLOGY', 'Gynécologie-Obstétrique'), ('EMERGENCY', 'Urgences'), ('MATERNITY', 'Maternité'), ('DENTISTRY', 'Dentisterie'), ('CARDIOLOGY', 'Cardiologie'), ('NEUROLOGY', 'Neurologie'), ('NEPHROLOGY', 'Néphrologie'), ('ONCOLOGY', 'Oncologie'), ('ORTHOPEDICS', 'Orthopédie'), ('OPHTHALMOLOGY', 'Ophtalmologie'), ('DERMATOLOGY', 'Dermatologie'), ('PSYCHIATRY', 'Psychiatrie'), ('PULMONOLOGY', 'Pneumologie'), ('GASTROENTEROLOGY', 'Gastroentérologie'), ('ENDOCRINOLOGY', 'Endocrinologie'), ('RHEUMATOLOGY', 'Rhumatologie'), ('UROLOGY', 'Urologie'), ('ENT', 'ORL (Oto-rhino-laryngologie)'), ('HEMATOLOGY', 'Hématologie'), ('INFECTIOUS_DISEASE', 'Maladies infectieuses'), ('RADIOLOGY', 'Radiologie'), ('ECHOGRAPHY', 'Échographie'), ('SCANNER_MRI', 'Scanner / IRM'), ('LABORATORY', 'Analyses de laboratoire'), ('CARDIAC_SURGERY', 'Chirurgie cardiaque'), ('NEUROSURGERY', 'Neurochirurgie'), ('PLASTIC_SURGERY', 'Chirurgie plastique'), ('VASCULAR_SURGERY', 'Chirurgie vasculaire'), ('PHYSIOTHERAPY', 'Kinésithérapie'), ('NUTRITION', 'Nutrition & Diététique'), ('PSYCHOLOGY', 'Psychologie'), ('PALLIATIVE_CARE', 'Soins palliatifs'), ('BLOOD_BANK', 'Banque de sang'), ('VACCINATION', 'Vaccination & Prévention'), ('OTHER', 'Autre')], default='OTHER', max_length=30),
        ),
        # Nettoyer les valeurs texte invalides AVANT de changer le type en JSON
        migrations.RunSQL(
            sql="UPDATE hospital_medicalservice SET operating_hours = '{}' WHERE operating_hours IS NOT NULL AND operating_hours != ''",
            reverse_sql=migrations.RunSQL.noop,
        ),
        migrations.AlterField(
            model_name='medicalservice',
            name='operating_hours',
            field=models.JSONField(blank=True, default=dict),
        ),
        migrations.AlterField(
            model_name='medicalservice',
            name='category',
            field=models.CharField(choices=[('GENERAL', 'Service Général'), ('SPECIALIZED', 'Service Spécialisé'), ('CARE_PACKAGE', 'Paquet de Soins'), ('DIAGNOSTIC', 'Diagnostic & Imagerie'), ('SURGICAL', 'Chirurgie'), ('EMERGENCY', 'Urgences'), ('MATERNITY', 'Maternité & Obstétrique'), ('PEDIATRIC', 'Pédiatrie'), ('REHABILITATION', 'Rééducation & Kinésithérapie'), ('PHARMACY', 'Pharmacie'), ('TELEMEDICINE', 'Télémédecine')], default='GENERAL', max_length=20),
        ),
        migrations.AlterModelOptions(
            name='medicalservice',
            options={'ordering': ['display_order', 'category', 'name'], 'verbose_name': 'Service Médical', 'verbose_name_plural': 'Services Médicaux'},
        ),
        migrations.AddIndex(
            model_name='medicalservice',
            index=models.Index(fields=['hospital', 'is_active'], name='idx_service_hospital_active'),
        ),
        migrations.AddIndex(
            model_name='medicalservice',
            index=models.Index(fields=['category', 'service_type'], name='idx_service_cat_type'),
        ),
    ]
