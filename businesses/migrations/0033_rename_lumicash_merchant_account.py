from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('businesses', '0032_provider_module'),
    ]

    operations = [
        migrations.RenameField(
            model_name='business',
            old_name='lumicash_merchant_account',
            new_name='burundipay_merchant_account',
        ),
    ]
