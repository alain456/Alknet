"""Frais de scolarité : faculté, programme, option et niveau."""

from datetime import datetime

from rest_framework import serializers


def clean_installments(rows):
    if not isinstance(rows, list):
        raise serializers.ValidationError('Les tranches sont invalides.')
    if len(rows) > 12:
        raise serializers.ValidationError('Douze tranches au maximum.')
    clean = []
    for index, row in enumerate(rows, start=1):
        if not isinstance(row, dict):
            raise serializers.ValidationError('Une tranche est invalide.')
        label = str(row.get('label') or f'Tranche {index}').strip()[:80] or f'Tranche {index}'
        try:
            amount = int(row.get('amount_bif') or 0)
        except (TypeError, ValueError):
            raise serializers.ValidationError(f'Le montant de « {label} » doit être un nombre.')
        if amount < 0:
            raise serializers.ValidationError(f'Le montant de « {label} » ne peut pas être négatif.')
        due = str(row.get('due_date') or '').strip()[:10]
        if not due:
            raise serializers.ValidationError(f'Indiquez la date de « {label} ».')
        try:
            datetime.strptime(due, '%Y-%m-%d')
        except ValueError:
            raise serializers.ValidationError(f'La date de « {label} » est invalide.')
        clean.append({'label': label, 'amount_bif': amount, 'due_date': due})
    return clean


def clean_tuition(value):
    """Barème enregistré : année académique et un ou plusieurs calendriers.

    Un calendrier vise tout le cycle, ou un niveau (BAC I) et/ou une option.
    L'ancienne forme (tranches uniques) reste acceptée.
    """
    if not value:
        return {}
    if not isinstance(value, dict):
        raise serializers.ValidationError('Le frais de scolarité est invalide.')
    year = str(value.get('academic_year') or '').strip()[:20]
    raw_schedules = value.get('schedules')
    if raw_schedules is None and value.get('installments'):
        raw_schedules = [{
            'year_label': '',
            'option': '',
            'installments': value.get('installments'),
        }]
    if not raw_schedules:
        return {}
    if not isinstance(raw_schedules, list):
        raise serializers.ValidationError('Les barèmes sont invalides.')
    if len(raw_schedules) > 18:
        raise serializers.ValidationError('Dix-huit barèmes au maximum.')
    schedules = []
    seen = set()
    for row in raw_schedules:
        if not isinstance(row, dict):
            raise serializers.ValidationError('Un barème est invalide.')
        year_label = str(row.get('year_label') or '').strip()[:40]
        option = str(row.get('option') or '').strip()[:80]
        installments = clean_installments(row.get('installments') or [])
        if not installments:
            continue
        key = (year_label.casefold(), option.casefold())
        if key in seen:
            scope = ' · '.join(part for part in (option, year_label) if part) or 'tous les niveaux'
            raise serializers.ValidationError(f'Deux barèmes visent « {scope} ».')
        seen.add(key)
        schedules.append({
            'year_label': year_label,
            'option': option,
            'installments': installments,
        })
    if schedules and not year:
        raise serializers.ValidationError('Indiquez l’année académique du frais de scolarité.')
    if not schedules:
        return {}
    return {'academic_year': year, 'schedules': schedules}


def normalize_tuition(value):
    try:
        return clean_tuition(value or {})
    except serializers.ValidationError:
        return {}


def _schedule_for(program):
    """Le programme prime, puis son département, puis sa faculté."""
    own = normalize_tuition(getattr(program, 'tuition', None))
    if own.get('schedules'):
        return own, 'programme'
    unit = getattr(program, 'unit', None)
    if not unit:
        return {}, ''
    local = normalize_tuition(getattr(unit, 'tuition', None))
    if local.get('schedules'):
        return local, unit.name
    parent = getattr(unit, 'parent', None)
    inherited = normalize_tuition(getattr(parent, 'tuition', None)) if parent else {}
    if inherited.get('schedules'):
        return inherited, parent.name
    return {}, ''


def _pick(schedules, option, year_label):
    def match(wanted_option, wanted_year):
        for row in schedules:
            if row.get('option', '') == wanted_option and row.get('year_label', '') == wanted_year:
                return row
        return None

    return (
        match(option, year_label)
        or match('', year_label)
        or match(option, '')
        or match('', '')
    )


def _signature(installments):
    return tuple((row['label'], row['amount_bif'], row['due_date']) for row in installments)


def _collapse(lines):
    if not lines:
        return []
    if len(lines) == 1:
        return lines
    if len({_signature(line['installments']) for line in lines}) == 1:
        years = {line['year_label'] for line in lines}
        options = {line['option'] for line in lines}
        return [{
            'year_label': '' if len(years) > 1 else next(iter(years)),
            'option': '' if len(options) > 1 else next(iter(options)),
            'installments': lines[0]['installments'],
        }]
    by_year = {}
    by_option = {}
    for line in lines:
        by_year.setdefault(line['year_label'], []).append(line)
        by_option.setdefault(line['option'], []).append(line)
    year_uniform = all(len({_signature(row['installments']) for row in rows}) == 1 for rows in by_year.values())
    option_uniform = all(len({_signature(row['installments']) for row in rows}) == 1 for rows in by_option.values())
    if year_uniform and (not option_uniform or len(by_year) <= len(by_option)):
        return [
            {'year_label': year, 'option': '', 'installments': rows[0]['installments']}
            for year, rows in by_year.items()
        ]
    if option_uniform:
        return [
            {'year_label': '', 'option': option, 'installments': rows[0]['installments']}
            for option, rows in by_option.items()
        ]
    return lines


def present_program_tuition(program):
    """Barème affiché : celui du programme, sinon celui de sa faculté."""
    from .enrollment import university_study_years

    chosen, source = _schedule_for(program)
    if not chosen.get('schedules'):
        return {}
    years = university_study_years(program)
    options = [str(item).strip() for item in (getattr(program, 'options', None) or []) if str(item).strip()]
    if not options:
        options = ['']
    schedules = chosen['schedules']
    used = set()
    lines = []
    for option in options:
        for year_label in years:
            row = _pick(schedules, option, year_label)
            if not row:
                continue
            used.add(id(row))
            lines.append({
                'year_label': year_label,
                'option': option,
                'installments': row['installments'],
            })
    for row in schedules:
        if id(row) in used:
            continue
        lines.append({
            'year_label': row.get('year_label') or '',
            'option': row.get('option') or '',
            'installments': row['installments'],
        })
    return {
        'academic_year': chosen.get('academic_year') or '',
        'source': source,
        'lines': _collapse(lines),
    }
