from django.db import migrations


def grant_app_role(apps, schema_editor):
    if schema_editor.connection.vendor != 'postgresql':
        return
    schema_editor.execute(
        """
        DO $$
        BEGIN
          IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'isoko_app') THEN
            GRANT ALL ON TABLE
              businesses_stockalert,
              businesses_inventorysession,
              businesses_inventoryline
            TO isoko_app;
            GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO isoko_app;
            ALTER DEFAULT PRIVILEGES IN SCHEMA public
              GRANT ALL ON TABLES TO isoko_app;
            ALTER DEFAULT PRIVILEGES IN SCHEMA public
              GRANT ALL ON SEQUENCES TO isoko_app;
          END IF;
        END $$;
        """
    )


class Migration(migrations.Migration):

    dependencies = [
        ('businesses', '0030_inventory_session'),
    ]

    operations = [
        migrations.RunPython(grant_app_role, migrations.RunPython.noop),
    ]
