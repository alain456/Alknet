from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('education', '0020_school_roster_fields'),
    ]

    operations = [
        migrations.AddField(
            model_name='educationprofile',
            name='enrollment_received_message',
            field=models.TextField(blank=True, default=''),
        ),
        migrations.AddField(
            model_name='educationprofile',
            name='enrollment_refusal_message',
            field=models.TextField(blank=True, default=''),
        ),
        migrations.AddField(
            model_name='educationprofile',
            name='enrollment_accepted_message',
            field=models.TextField(blank=True, default=''),
        ),
    ]
