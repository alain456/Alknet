from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('hospital', '0022_hospital_appointment_email_templates'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='hospitalprofile',
            name='appointment_confirmation_default_message',
        ),
    ]
