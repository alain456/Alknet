"""Un seul PDF : récapitulatif de la candidature, puis chaque pièce jointe."""
from __future__ import annotations

import logging
from io import BytesIO

from django.core.files.base import ContentFile
from pypdf import PdfReader, PdfWriter
from pypdf.errors import PdfReadError
from reportlab.lib.pagesizes import A4
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfgen import canvas

logger = logging.getLogger(__name__)

PAGE_W, PAGE_H = A4


def _text(value):
    raw = str(value or '').replace('\r', ' ').replace('\n', ' ').strip()
    try:
        raw.encode('cp1252')
        return raw
    except UnicodeEncodeError:
        return raw.encode('cp1252', 'replace').decode('cp1252')


def _wrap(text, font, size, width):
    words = _text(text).split()
    if not words:
        return ['']
    lines = []
    current = words[0]
    for word in words[1:]:
        trial = f'{current} {word}'
        if pdfmetrics.stringWidth(trial, font, size) <= width:
            current = trial
        else:
            lines.append(current)
            current = word
    lines.append(current)
    return lines


def _page(title, rows):
    buffer = BytesIO()
    sheet = canvas.Canvas(buffer, pagesize=A4)
    y = PAGE_H - 48
    sheet.setFont('Helvetica-Bold', 16)
    for line in _wrap(title, 'Helvetica-Bold', 16, PAGE_W - 80):
        sheet.drawString(40, y, line)
        y -= 20
    y -= 8
    for label, value in rows:
        if y < 72:
            sheet.showPage()
            y = PAGE_H - 48
        sheet.setFont('Helvetica-Bold', 10)
        sheet.drawString(40, y, _text(label))
        y -= 14
        sheet.setFont('Helvetica', 11)
        for line in _wrap(value or '—', 'Helvetica', 11, PAGE_W - 80):
            if y < 48:
                sheet.showPage()
                y = PAGE_H - 48
                sheet.setFont('Helvetica', 11)
            sheet.drawString(40, y, line)
            y -= 14
        y -= 6
    sheet.showPage()
    sheet.save()
    buffer.seek(0)
    return buffer


def _note_page(message):
    return _page('Pièce non intégrée', [('Détail', message)])


def _image_page(data, label):
    from PIL import Image, UnidentifiedImageError

    try:
        image = Image.open(BytesIO(data))
        image = image.convert('RGB')
    except (UnidentifiedImageError, OSError):
        return _note_page(f'{label} : image illisible.')
    image.thumbnail((1400, 1800))
    payload = BytesIO()
    image.save(payload, format='JPEG', quality=82)
    payload.seek(0)
    reader = ImageReader(payload)
    width, height = image.size
    buffer = BytesIO()
    sheet = canvas.Canvas(buffer, pagesize=A4)
    sheet.setFont('Helvetica-Bold', 12)
    sheet.drawString(40, PAGE_H - 36, _text(label)[:90])
    max_w, max_h = PAGE_W - 80, PAGE_H - 80
    scale = min(max_w / width, max_h / height, 1)
    draw_w, draw_h = width * scale, height * scale
    sheet.drawImage(reader, 40, PAGE_H - 52 - draw_h, draw_w, draw_h, preserveAspectRatio=True, anchor='n')
    sheet.showPage()
    sheet.save()
    buffer.seek(0)
    return buffer


def _append(writer, stream):
    reader = PdfReader(stream)
    if reader.is_encrypted:
        reader.decrypt('')
    writer.append(reader)


def compose_dossier_pdf(title, rows, attachments):
    """attachments = liste de (libellé, octets, nom de fichier)."""
    writer = PdfWriter()
    _append(writer, _page(title, rows))
    for label, data, name in attachments:
        blob = data or b''
        filename = (name or '').lower()
        try:
            if blob[:4] == b'%PDF' or filename.endswith('.pdf'):
                _append(writer, _page(label, [('Document', 'Les pages suivantes sont cette pièce.')]))
                _append(writer, BytesIO(blob))
            elif filename.endswith(('.jpg', '.jpeg', '.png', '.webp', '.gif')) or blob[:3] == b'\xff\xd8\xff' or blob[:8] == b'\x89PNG\r\n\x1a\n':
                _append(writer, _image_page(blob, label))
            else:
                _append(writer, _note_page(f'{label} : format non repris dans le PDF ({name or "fichier"}).'))
        except (PdfReadError, Exception):
            logger.exception('Pièce ignorée dans le dossier PDF: %s', label)
            _append(writer, _note_page(f'{label} : fichier illisible, non ajouté au PDF.'))
    out = BytesIO()
    writer.write(out)
    return out.getvalue()


def _rows_for_application(application):
    campaign = application.campaign
    gender = {'F': 'Féminin', 'M': 'Masculin'}.get(application.gender, application.gender or '—')
    rows = [
        ('Établissement', campaign.business.name),
        ('Année', campaign.academic_year),
    ]
    if campaign.program_id:
        details = application.profile_details or {}
        rows.extend([
            ('Programme', campaign.program.title),
            ('Niveau', details.get('study_year') or '—'),
            ('Option', details.get('program_option') or '—'),
            ('Prénom', details.get('first_name') or '—'),
            ('Deuxième prénom', details.get('middle_name') or '—'),
            ('Nom', details.get('last_name') or application.student_name),
            ('Date de naissance', application.birth_date.isoformat() if application.birth_date else '—'),
            ('Sexe', gender),
            ('Nationalité', details.get('nationality') or '—'),
            ('État civil', details.get('marital_status') or '—'),
            ('E-mail', application.student_email),
            ('Téléphone', application.student_phone),
            ('Adresse', application.student_address),
            ('Dernier établissement', application.previous_school),
            ('Dernière année (%)', details.get('last_percent') or '—'),
            ('Examen d’État (%)', details.get('state_exam_percent') or '—'),
            ('Études déjà déclarées', details.get('studies_declared') or '—'),
            ('Contact', application.guardian_link),
            ('Nom du contact', application.guardian_name),
            ('E-mail du contact', details.get('guardian_email') or '—'),
            ('Téléphone du contact', application.guardian_phone),
            ('Adresse du contact', details.get('guardian_address') or '—'),
        ])
    else:
        from .school_enrollment_docs import track_label
        from .school_years import year_label

        place = track_label(application.track)
        if application.track == 'ECOFO' and application.ecofo_year:
            place = f'{place} · {year_label(application.ecofo_year)}'
        if application.track == 'POST_FONDAMENTAL':
            place = ' · '.join(part for part in (place, application.post_section, year_label(application.post_year) if application.post_year else '') if part)
        rows.extend([
            ('Parcours', place or '—'),
            ('Nom', application.student_name),
            ('E-mail', application.student_email),
            ('Téléphone', application.student_phone),
            ('Date de naissance', application.birth_date.isoformat() if application.birth_date else '—'),
            ('Sexe', gender),
            ('École précédente', application.previous_school or '—'),
            ('Adresse', application.student_address or '—'),
            ('Lien du parent', application.guardian_link or '—'),
            ('Nom du parent', application.guardian_name),
            ('Téléphone du parent', application.guardian_phone),
            ('Critères supplémentaires acceptés', 'Oui' if application.criteria_acknowledged else 'Non'),
        ])
    return rows


def _attachments_for_application(application):
    pieces = []
    for document in application.files.all():
        try:
            document.file.open('rb')
            pieces.append((document.label, document.file.read(), document.file.name))
        except Exception:
            logger.exception('Lecture pièce %s', document.label)
            pieces.append((document.label, b'', document.label))
        finally:
            try:
                document.file.close()
            except Exception:
                pass
    return pieces


def render_application_dossier(application):
    campaign = application.campaign
    title = f'Dossier — {application.student_name or campaign.business.name}'
    return compose_dossier_pdf(title, _rows_for_application(application), _attachments_for_application(application))


def store_compiled_dossier(application):
    payload = render_application_dossier(application)
    application.document.save(f'dossier-{application.pk}.pdf', ContentFile(payload), save=True)
    return payload


def render_preview(campaign, data, files_by_label):
    """PDF avant envoi, sans enregistrer la candidature."""
    from .enrollment import read_university_candidature, resolve_school_track_fields
    from .school_enrollment_docs import track_label
    from .school_years import year_label

    email = (data.get('student_email') or '').strip()
    phone = (data.get('student_phone') or '').strip()
    rows = [
        ('Établissement', campaign.business.name),
        ('Année', campaign.academic_year),
    ]
    if campaign.program_id:
        acknowledged = str(data.get('terms_ack') or '').strip().lower() in ('1', 'true', 'yes', 'on')
        source = data
        if not acknowledged:
            source = data.copy()
            source['terms_ack'] = '1'
        university = read_university_candidature(source, campaign.program)
        details = university['profile_details']
        gender = {'F': 'Féminin', 'M': 'Masculin'}.get(university['gender'], university['gender'])
        rows.extend([
            ('Programme', campaign.program.title),
            ('Niveau', details.get('study_year') or '—'),
            ('Option', details.get('program_option') or '—'),
            ('Nom', university['student_name']),
            ('Date de naissance', university['birth_date'].isoformat()),
            ('Sexe', gender),
            ('Nationalité', details.get('nationality') or '—'),
            ('État civil', details.get('marital_status') or '—'),
            ('E-mail', email),
            ('Téléphone', phone),
            ('Adresse', university['student_address']),
            ('Dernier établissement', university['previous_school']),
            ('Dernière année (%)', details.get('last_percent') or '—'),
            ('Examen d’État (%)', details.get('state_exam_percent') or '—'),
            ('Études déjà déclarées', details.get('studies_declared') or '—'),
            ('Contact', university['guardian_link']),
            ('Nom du contact', university['guardian_name']),
            ('E-mail du contact', details.get('guardian_email') or '—'),
            ('Téléphone du contact', university['guardian_phone']),
            ('Adresse du contact', details.get('guardian_address') or '—'),
            ('Conditions confirmées', 'Oui' if acknowledged else 'Pas encore'),
        ])
        title = f'Dossier — {university["student_name"]}'
    else:
        profile = getattr(campaign.business, 'education_profile', None)
        track, ecofo_year, post_section, post_year, _docs, _wait = resolve_school_track_fields(
            campaign,
            data.get('track'),
            data.get('ecofo_year'),
            data.get('post_section'),
            data.get('post_year'),
            profile,
        )
        place = track_label(track)
        if track == 'ECOFO' and ecofo_year:
            place = f'{place} · {year_label(ecofo_year)}'
        if track == 'POST_FONDAMENTAL':
            place = ' · '.join(part for part in (place, post_section, year_label(post_year) if post_year else '') if part)
        gender = {'F': 'Féminin', 'M': 'Masculin'}.get(str(data.get('gender') or '').upper()[:1], '—')
        rows.extend([
            ('Parcours', place or '—'),
            ('Nom', (data.get('student_name') or '').strip()),
            ('E-mail', email),
            ('Téléphone', phone),
            ('Date de naissance', str(data.get('birth_date') or '—')),
            ('Sexe', gender),
            ('École précédente', (data.get('previous_school') or '').strip() or '—'),
            ('Adresse', (data.get('student_address') or '').strip() or '—'),
            ('Lien du parent', (data.get('guardian_link') or '').strip() or '—'),
            ('Nom du parent', (data.get('guardian_name') or '').strip()),
            ('Téléphone du parent', (data.get('guardian_phone') or '').strip()),
        ])
        title = f'Dossier — {(data.get("student_name") or "").strip() or campaign.business.name}'

    attachments = []
    for label, uploaded in files_by_label.items():
        uploaded.seek(0)
        attachments.append((label, uploaded.read(), getattr(uploaded, 'name', '') or label))
        uploaded.seek(0)
    return compose_dossier_pdf(title, rows, attachments)
