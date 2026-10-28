from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('services', '0006_teammember_photo'),
    ]

    operations = [
        migrations.AddField(
            model_name='providerdocument',
            name='description',
            field=models.TextField(blank=True, default=''),
        ),
        migrations.AddField(
            model_name='providerdocument',
            name='sort_order',
            field=models.PositiveIntegerField(default=0),
        ),
        migrations.AlterField(
            model_name='providerdocument',
            name='kind',
            field=models.CharField(
                choices=[
                    ('ACTIVITY', 'Image d’activité'),
                    ('TESTIMONY', 'Vidéo témoignage'),
                    ('CERTIFICATE', 'Certificat'),
                    ('ATTESTATION', 'Attestation'),
                    ('OTHER', 'Autre justificatif'),
                ],
                default='ACTIVITY',
                max_length=20,
            ),
        ),
        migrations.AlterField(
            model_name='providerdocument',
            name='is_public',
            field=models.BooleanField(default=True),
        ),
        migrations.AlterModelOptions(
            name='providerdocument',
            options={'ordering': ['sort_order', '-created_at']},
        ),
    ]
