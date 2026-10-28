import secrets
import uuid

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
import django.utils.timezone


def fill_dossiers(apps, schema_editor):
    ContactRequest = apps.get_model('services', 'ContactRequest')
    ContactMessage = apps.get_model('services', 'ContactMessage')
    seen_refs = set(ContactRequest.objects.exclude(reference='').values_list('reference', flat=True))
    seen_tokens = set(ContactRequest.objects.exclude(public_token='').values_list('public_token', flat=True))
    counts = {}
    for row in ContactRequest.objects.select_related('business').order_by('created_at'):
        prefix = ''.join(ch for ch in str(row.business.name or 'DEM').upper() if ch.isalnum())[:6] or 'DEM'
        counts[row.business_id] = counts.get(row.business_id, 0) + 1
        if not row.reference:
            n = counts[row.business_id]
            candidate = f'{prefix}-{n:04d}'
            while candidate in seen_refs:
                n += 1
                candidate = f'{prefix}-{n:04d}'
            row.reference = candidate
            seen_refs.add(candidate)
        if not row.public_token:
            token = secrets.token_urlsafe(24)[:48]
            while token in seen_tokens:
                token = secrets.token_urlsafe(24)[:48]
            row.public_token = token
            seen_tokens.add(token)
        row.save(update_fields=['reference', 'public_token'])
        if row.message and not ContactMessage.objects.filter(request_id=row.id).exists():
            ContactMessage.objects.create(
                id=uuid.uuid4(),
                request=row,
                kind='CLIENT',
                body=row.message,
                created_at=row.created_at,
            )


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('services', '0008_contact_address'),
    ]

    operations = [
        migrations.AddField(
            model_name='contactrequest',
            name='public_token',
            field=models.CharField(blank=True, default='', max_length=48),
        ),
        migrations.AddField(
            model_name='contactrequest',
            name='reference',
            field=models.CharField(blank=True, default='', max_length=24),
        ),
        migrations.CreateModel(
            name='ContactMessage',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('kind', models.CharField(choices=[('CLIENT', 'Client'), ('PROVIDER', 'Prestataire'), ('INTERNAL', 'Note interne')], max_length=12)),
                ('body', models.TextField()),
                ('created_at', models.DateTimeField(default=django.utils.timezone.now)),
                ('author', models.ForeignKey(
                    blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL,
                    related_name='service_contact_messages', to=settings.AUTH_USER_MODEL,
                )),
                ('request', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='thread', to='services.contactrequest',
                )),
            ],
            options={
                'ordering': ['created_at'],
            },
        ),
        migrations.RunPython(fill_dossiers, migrations.RunPython.noop),
        migrations.AlterField(
            model_name='contactrequest',
            name='public_token',
            field=models.CharField(max_length=48, unique=True),
        ),
        migrations.AlterField(
            model_name='contactrequest',
            name='reference',
            field=models.CharField(max_length=24, unique=True),
        ),
    ]
