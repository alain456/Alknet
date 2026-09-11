# Generated manually for ContactMessage

import uuid
from django.db import migrations, models
import django.utils.timezone


class Migration(migrations.Migration):

    dependencies = [
        ("site_content", "0004_password_min_length"),
    ]

    operations = [
        migrations.CreateModel(
            name="ContactMessage",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("name", models.CharField(max_length=150)),
                ("email", models.EmailField(max_length=254)),
                ("phone", models.CharField(blank=True, max_length=50)),
                ("subject", models.CharField(max_length=200)),
                ("message", models.TextField()),
                ("is_read", models.BooleanField(default=False)),
                ("admin_notes", models.TextField(blank=True)),
                ("ip_address", models.GenericIPAddressField(blank=True, null=True)),
                ("created_at", models.DateTimeField(default=django.utils.timezone.now)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
            options={
                "verbose_name": "Message de contact",
                "verbose_name_plural": "Messages de contact",
                "ordering": ["-created_at"],
            },
        ),
    ]
