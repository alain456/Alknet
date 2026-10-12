from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0006_email_otp'),
    ]

    operations = [
        migrations.AddField(
            model_name='loginotp',
            name='attempts',
            field=models.PositiveSmallIntegerField(default=0),
        ),
        migrations.CreateModel(
            name='AuthLock',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('email', models.CharField(max_length=255, unique=True)),
                ('failures', models.PositiveSmallIntegerField(default=0)),
                ('locked_until', models.DateTimeField(blank=True, null=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
        ),
    ]
