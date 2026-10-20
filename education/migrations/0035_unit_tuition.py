from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('education', '0034_program_tuition'),
    ]

    operations = [
        migrations.AddField(
            model_name='educationunit',
            name='tuition',
            field=models.JSONField(
                blank=True,
                default=dict,
                help_text='Barème de la faculté, pour les programmes qui n’ont pas le leur. Peut varier par niveau.',
                verbose_name='Frais de scolarité',
            ),
        ),
        migrations.AlterField(
            model_name='educationprogram',
            name='tuition',
            field=models.JSONField(
                blank=True,
                default=dict,
                help_text='Barème du programme. S’il est renseigné, il remplace celui de la faculté. Peut varier par option et par niveau.',
                verbose_name='Frais de scolarité',
            ),
        ),
    ]
