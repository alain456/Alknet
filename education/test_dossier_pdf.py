from io import BytesIO

from django.test import SimpleTestCase
from pypdf import PdfReader
from reportlab.pdfgen import canvas

from education.dossier_pdf import compose_dossier_pdf


def _tiny_pdf(label):
    buffer = BytesIO()
    sheet = canvas.Canvas(buffer)
    sheet.drawString(72, 720, label)
    sheet.save()
    return buffer.getvalue()


class DossierPdfTests(SimpleTestCase):
    def test_one_pdf_contains_summary_and_attachment(self):
        payload = compose_dossier_pdf(
            'Dossier — Aline',
            [('Nom', 'Aline Nday'), ('E-mail', 'aline@example.com')],
            [('Acte de naissance', _tiny_pdf('acte'), 'acte.pdf')],
        )
        self.assertTrue(payload.startswith(b'%PDF'))
        reader = PdfReader(BytesIO(payload))
        self.assertGreaterEqual(len(reader.pages), 2)
