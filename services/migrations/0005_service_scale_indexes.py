from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('services', '0004_service_parent'),
    ]

    operations = [
        migrations.AddIndex(
            model_name='service',
            index=models.Index(fields=['status', 'business'], name='services_se_status_biz_idx'),
        ),
        migrations.AddIndex(
            model_name='service',
            index=models.Index(fields=['parent', 'sort_order'], name='services_se_parent_sort_idx'),
        ),
        migrations.AddIndex(
            model_name='service',
            index=models.Index(fields=['title'], name='services_se_title_idx'),
        ),
        migrations.AddIndex(
            model_name='servicesubitem',
            index=models.Index(fields=['title'], name='services_su_title_idx'),
        ),
        migrations.AddIndex(
            model_name='serviceproviderprofile',
            index=models.Index(fields=['is_published'], name='services_pr_published_idx'),
        ),
        migrations.AddIndex(
            model_name='contactrequest',
            index=models.Index(fields=['business', 'status'], name='services_co_biz_status_idx'),
        ),
    ]
