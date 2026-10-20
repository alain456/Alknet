from django.test import SimpleTestCase
from rest_framework import serializers

from education.tuition import clean_tuition, present_program_tuition


class _Unit:
    def __init__(self, name, tuition=None, parent=None):
        self.name = name
        self.tuition = tuition or {}
        self.parent = parent


class _Program:
    level = 'LICENCE'
    duration_years = 3
    study_year_labels = []
    options = []
    tuition = {}
    unit = None


class TuitionCleanTests(SimpleTestCase):
    def test_legacy_installments_become_one_schedule(self):
        cleaned = clean_tuition({
            'academic_year': '2026-2027',
            'installments': [{'label': 'Tranche 1', 'amount_bif': 1000, 'due_date': '2026-10-31'}],
        })
        self.assertEqual(cleaned['schedules'][0]['year_label'], '')
        self.assertEqual(cleaned['schedules'][0]['option'], '')

    def test_duplicate_scope_is_rejected(self):
        with self.assertRaises(serializers.ValidationError):
            clean_tuition({
                'academic_year': '2026-2027',
                'schedules': [
                    {'year_label': 'BAC I', 'option': '', 'installments': [{'amount_bif': 1, 'due_date': '2026-10-01'}]},
                    {'year_label': 'BAC I', 'option': '', 'installments': [{'amount_bif': 2, 'due_date': '2026-11-01'}]},
                ],
            })


class TuitionPresentTests(SimpleTestCase):
    def test_program_schedule_replaces_faculty_and_splits_by_year(self):
        program = _Program()
        program.options = ['software engineering', 'réseaux']
        program.unit = _Unit('Sciences', tuition={
            'academic_year': '2026-2027',
            'schedules': [{
                'year_label': '',
                'option': '',
                'installments': [{'label': 'Tranche 1', 'amount_bif': 100, 'due_date': '2026-10-01'}],
            }],
        })
        program.tuition = {
            'academic_year': '2026-2027',
            'schedules': [
                {
                    'year_label': 'BAC I',
                    'option': 'software engineering',
                    'installments': [{'label': 'Tranche 1', 'amount_bif': 400, 'due_date': '2026-10-31'}],
                },
                {
                    'year_label': '',
                    'option': '',
                    'installments': [{'label': 'Tranche 1', 'amount_bif': 200, 'due_date': '2026-10-31'}],
                },
            ],
        }
        shown = present_program_tuition(program)
        self.assertEqual(shown['source'], 'programme')
        software_bac1 = next(
            line for line in shown['lines']
            if line['option'] == 'software engineering' and line['year_label'] == 'BAC I'
        )
        self.assertEqual(software_bac1['installments'][0]['amount_bif'], 400)
        shared = [
            line for line in shown['lines']
            if line['installments'][0]['amount_bif'] == 200
        ]
        self.assertTrue(shared)

    def test_department_fee_replaces_faculty_for_its_programs(self):
        program = _Program()
        faculty = _Unit('Sciences', tuition={
            'academic_year': '2026-2027',
            'schedules': [{
                'year_label': 'BAC I',
                'option': '',
                'installments': [{'label': 'Tranche 1', 'amount_bif': 100, 'due_date': '2026-10-01'}],
            }],
        })
        program.unit = _Unit('software engineering', tuition={
            'academic_year': '2026-2027',
            'schedules': [{
                'year_label': 'BAC I',
                'option': '',
                'installments': [{'label': 'Tranche 1', 'amount_bif': 900, 'due_date': '2026-10-31'}],
            }],
        }, parent=faculty)
        shown = present_program_tuition(program)
        self.assertEqual(shown['source'], 'software engineering')
        self.assertEqual(shown['lines'][0]['installments'][0]['amount_bif'], 900)

    def test_faculty_fee_applies_when_program_has_none(self):
        program = _Program()
        program.unit = _Unit('Sciences', tuition={
            'academic_year': '2026-2027',
            'schedules': [{
                'year_label': 'BAC II',
                'option': '',
                'installments': [{'label': 'Tranche 1', 'amount_bif': 250, 'due_date': '2027-01-31'}],
            }],
        })
        shown = present_program_tuition(program)
        self.assertEqual(shown['source'], 'Sciences')
        self.assertEqual(shown['lines'][0]['year_label'], 'BAC II')
        self.assertEqual(shown['lines'][0]['installments'][0]['amount_bif'], 250)
