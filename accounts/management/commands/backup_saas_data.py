"""
Sauvegarde opérationnelle SaaS — dump JSON des apps métier critiques.
Complète (ne remplace pas) les backups PostgreSQL volume / pg_dump infra.
"""
from __future__ import annotations

import json
from datetime import datetime, timedelta
from pathlib import Path

from django.apps import apps
from django.conf import settings
from django.core import serializers
from django.core.management.base import BaseCommand
from django.utils import timezone


# Apps tenant / plateforme à inclure dans le dump applicatif
BACKUP_APPS = [
    'accounts',
    'businesses',
    'business_categories',
    'hospital',
    'wholesale',
    'retail',
    'services',
    'service_categories',
    'products',
    'product_categories',
    'orders',
    'bookings',
    'offers',
    'profiles',
    'locations',
    'site_content',
]


class Command(BaseCommand):
    help = 'Crée une sauvegarde JSON des données métier SaaS (multi-tenant).'

    def add_arguments(self, parser):
        parser.add_argument(
            '--retention-days',
            type=int,
            default=None,
            help='Supprime les backups plus anciens (défaut: BACKUP_RETENTION_DAYS).',
        )

    def handle(self, *args, **options):
        root = Path(getattr(settings, 'BACKUP_ROOT', settings.BASE_DIR / 'backups'))
        root.mkdir(parents=True, exist_ok=True)

        stamp = timezone.now().strftime('%Y%m%d_%H%M%S')
        out_dir = root / f'snapshot_{stamp}'
        out_dir.mkdir(parents=True, exist_ok=True)

        manifest = {
            'created_at': timezone.now().isoformat(),
            'apps': [],
            'record_counts': {},
            'notes': [
                'Dump applicatif JSON — à combiner avec un pg_dump volume pour reprise complète.',
                'Isoler ce dossier (chiffrement au repos côté disque / object storage).',
                'Ne jamais exposer /backups via HTTP.',
            ],
        }

        total = 0
        for app_label in BACKUP_APPS:
            try:
                app_config = apps.get_app_config(app_label)
            except LookupError:
                self.stdout.write(self.style.WARNING(f'App absente: {app_label}'))
                continue

            models = [
                m for m in app_config.get_models()
                if not m._meta.proxy and m._meta.managed
            ]
            app_total = 0
            for model in models:
                label = f'{app_label}.{model.__name__}'
                try:
                    qs = model.objects.all()
                    count = qs.count()
                    app_total += count
                    manifest['record_counts'][label] = count
                    if count == 0:
                        continue
                    file_path = out_dir / f'{label}.json'
                    with file_path.open('w', encoding='utf-8') as fh:
                        serializers.serialize('json', qs.iterator(chunk_size=500), stream=fh, indent=2)
                except Exception as exc:
                    self.stdout.write(self.style.ERROR(f'Échec {label}: {exc}'))
                    manifest['record_counts'][label] = f'ERROR: {exc}'

            manifest['apps'].append({'app': app_label, 'records': app_total})
            total += app_total
            self.stdout.write(f'  ✓ {app_label}: {app_total} enregistrements')

        manifest['total_records'] = total
        (out_dir / 'manifest.json').write_text(
            json.dumps(manifest, indent=2, ensure_ascii=False),
            encoding='utf-8',
        )

        # Marqueur « dernier backup » pour le tableau de gouvernance
        latest = {
            'path': str(out_dir),
            'created_at': manifest['created_at'],
            'total_records': total,
        }
        (root / 'latest.json').write_text(json.dumps(latest, indent=2), encoding='utf-8')

        retention = options.get('retention_days')
        if retention is None:
            retention = int(getattr(settings, 'BACKUP_RETENTION_DAYS', 14))
        self._prune(root, retention)

        self.stdout.write(self.style.SUCCESS(
            f'Sauvegarde créée: {out_dir} ({total} enregistrements)'
        ))

    def _prune(self, root: Path, retention_days: int):
        if retention_days <= 0:
            return
        cutoff = timezone.now() - timedelta(days=retention_days)
        for path in root.glob('snapshot_*'):
            if not path.is_dir():
                continue
            try:
                # snapshot_YYYYMMDD_HHMMSS
                stamp = path.name.replace('snapshot_', '')
                created = datetime.strptime(stamp, '%Y%m%d_%H%M%S')
                created = timezone.make_aware(created, timezone.get_current_timezone())
            except ValueError:
                continue
            if created < cutoff:
                for child in path.rglob('*'):
                    if child.is_file():
                        child.unlink(missing_ok=True)
                path.rmdir()
                self.stdout.write(self.style.WARNING(f'Retiré (rétention): {path.name}'))
