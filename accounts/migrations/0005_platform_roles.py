from django.db import migrations, models
import uuid


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0004_social_identity'),
    ]

    operations = [
        migrations.AlterField(
            model_name='customuser',
            name='role',
            field=models.CharField(
                choices=[
                    ('SUPER_ADMIN', 'Super Admin'),
                    ('PLATFORM_FINANCE', 'Finance plateforme'),
                    ('PLATFORM_MODERATION', 'Modération'),
                    ('PLATFORM_SUPPORT', 'Support'),
                    ('PLATFORM_CONTENT', 'Contenu'),
                    ('CUSTOMER', 'Customer'),
                    ('PROFESSIONAL', 'Professional'),
                    ('BUSINESS_OWNER', 'Business Owner'),
                ],
                default='CUSTOMER',
                max_length=50,
            ),
        ),
        migrations.CreateModel(
            name='PlatformRole',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('code', models.SlugField(max_length=40, unique=True)),
                ('name', models.CharField(max_length=120)),
                ('description', models.TextField(blank=True)),
                ('permissions', models.JSONField(blank=True, default=list)),
                ('is_locked', models.BooleanField(default=False)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={
                'verbose_name': 'Rôle plateforme',
                'verbose_name_plural': 'Rôles plateforme',
                'ordering': ['name'],
            },
        ),
    ]
