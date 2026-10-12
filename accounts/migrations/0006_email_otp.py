from django.db import migrations, models
import django.db.models.deletion
import uuid


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0005_platform_roles'),
    ]

    operations = [
        migrations.AddField(
            model_name='customuser',
            name='email_otp_enabled',
            field=models.BooleanField(default=False, help_text='Si actif, la connexion exige un code envoyé par e-mail.'),
        ),
        migrations.CreateModel(
            name='LoginOtp',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('code_hash', models.CharField(max_length=128)),
                ('expires_at', models.DateTimeField()),
                ('used', models.BooleanField(default=False)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='login_otps', to='accounts.customuser')),
            ],
        ),
    ]
