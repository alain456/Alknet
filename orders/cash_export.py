"""Export de la caisse en Excel et en CSV.

Deux chemins, une seule source de données : les agrégats viennent de la même
caisse que l'écran, donc un export ne peut pas dire autre chose que l'écran.

- Excel (.xlsx) : vrai classeur, une feuille par état, totaux en bas.
- CSV : le format le plus universel, et la voie du PDF côté client (le
  navigateur transforme en tableau propre). Aucun moteur PDF n'est installé
  côté serveur, et en ajouter un pour deux listes n'en vaut pas le coup.
"""
from __future__ import annotations

import csv
import io
from datetime import datetime, timezone as dt_timezone

from openpyxl import Workbook
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter

from .models import CashCollection

HEADER_FILL = PatternFill('solid', fgColor='0F766E')
HEADER_FONT = Font(color='FFFFFF', bold=True, size=11)
TITLE_FONT = Font(bold=True, size=13)
TOTAL_FONT = Font(bold=True)
TOTAL_FILL = PatternFill('solid', fgColor='F1F5F9')
THIN = Side(style='thin', color='CBD5E1')
BORDER = Border(bottom=THIN)
MONEY_FMT = '# ##0.00'

LABELS = {
    'CASH': 'Espèces',
    'MOBILE_MONEY': 'Mobile money',
    'CARD': 'Carte',
    'TRANSFER': 'Virement',
    'BURUNDIPAY': 'BurundiPay',
    'OTHER': 'Autre',
}
SOURCE_LABELS = dict(CashCollection.SOURCE_CHOICES)


def _m(value) -> str:
    """Montant au format burundais, sans notation scientifique."""
    if value is None:
        return ''
    return f'{float(value):,.2f}'.replace(',', ' ').replace('.', ',')


def _stamp() -> str:
    return datetime.now(dt_timezone.utc).strftime('%Y%m%d-%H%M')


def _safe(value, limit=60) -> str:
    """Neutralise les formulae : un client nommé =cmd injecterait du code."""
    text = '' if value is None else str(value)
    text = text.strip().replace('\n', ' ').replace('\r', ' ')
    if text[:1] in ('=', '+', '-', '@'):
        text = f"'{text}"
    return text[:limit]


# ══════════════════════════════════════════════════════════════════
# Lignes d'export
# ══════════════════════════════════════════════════════════════════

def journal_rows(collections) -> list[list]:
    """Lignes du journal, alignées sur l'ordre des colonnes plus bas."""
    rows = []
    for c in collections:
        rows.append([
            _safe(c.collected_at.strftime('%Y-%m-%d %H:%M') if c.collected_at else ''),
            _safe(c.source_order_ref, 40),
            _safe(c.customer_name),
            _safe(c.get_source_display()),
            _safe(c.get_method_display()),
            _safe(c.get_status_display()),
            _safe(c.external_reference, 40),
            _safe(c.received_by.get_full_name() if c.received_by else '', 60),
            _m(c.amount),
            _safe(c.currency, 8),
        ])
    return rows


JOURNAL_COLUMNS = [
    'Date', 'Référence', 'Client', 'Origine', 'Méthode', 'Statut',
    'Réf. paiement', 'Encaissé par', 'Montant', 'Devise',
]


def missing_rows(orders) -> list[list]:
    """Lignes des encaissements manquants."""
    rows = []
    for o in orders:
        rows.append([
            _safe(o['reference'], 40),
            _safe(o.get('customer_name')),
            _safe(o.get('method') or 'BurundiPay'),
            _safe(o.get('provider_reference', ''), 40),
            _safe(o['paid_at'].strftime('%Y-%m-%d %H:%M') if o.get('paid_at') else ''),
            _m(o['total_amount']),
        ])
    return rows


MISSING_COLUMNS = [
    'Référence', 'Client', 'Paiement', 'Réf. paiement', 'Payé le', 'Montant manquant',
]


# ══════════════════════════════════════════════════════════════════
# Feuille Excel
# ══════════════════════════════════════════════════════════════════

def _write_sheet(ws, title, subtitle, columns, rows, total_label=None, total=None):
    ws.title = title[:31]
    ws['A1'] = subtitle
    ws['A1'].font = TITLE_FONT
    ws['A2'] = f'Édité le {datetime.now().strftime("%d/%m/%Y à %H:%M")}'
    ws['A2'].font = Font(color='64748B', size=9)

    header_row = 4
    for idx, col in enumerate(columns, start=1):
        cell = ws.cell(row=header_row, column=idx, value=col)
        cell.fill = HEADER_FILL
        cell.font = HEADER_FONT
        cell.alignment = Alignment(horizontal='left', vertical='center')
    ws.freeze_panes = ws.cell(row=header_row + 1, column=1)

    for r, data in enumerate(rows, start=header_row + 1):
        for c, value in enumerate(data, start=1):
            cell = ws.cell(row=r, column=c, value=value)
            cell.border = BORDER
            if isinstance(value, str) and _looks_money(value):
                cell.number_format = MONEY_FMT
                cell.alignment = Alignment(horizontal='right')

    if total is not None:
        row = header_row + 1 + len(rows)
        cell = ws.cell(row=row, column=1, value=total_label)
        cell.font = TOTAL_FONT
        cell.fill = TOTAL_FILL
        last = ws.cell(row=row, column=len(columns), value=_m(total))
        last.font = TOTAL_FONT
        last.fill = TOTAL_FILL
        last.number_format = MONEY_FMT
        last.alignment = Alignment(horizontal='right')

    for idx, col in enumerate(columns, start=1):
        width = len(col) + 4
        for data in rows[:200]:
            if idx - 1 < len(data):
                width = max(width, len(str(data[idx - 1])) + 2)
        ws.column_dimensions[get_column_letter(idx)].width = min(width, 46)


def _looks_money(value) -> bool:
    if not isinstance(value, str) or not value:
        return False
    try:
        float(value.replace(' ', '').replace(',', '.'))
    except ValueError:
        return False
    return True


def build_workbook(business_name, journal, missing, dashboard) -> bytes:
    """Classeur complet : synthèse, journal, manquants."""
    wb = Workbook()

    ws = wb.active
    ws.title = 'Synthèse'
    ws['A1'] = 'Synthèse de caisse'
    ws['A1'].font = Font(bold=True, size=15)
    ws['A2'] = business_name
    ws['A2'].font = Font(color='64748B', size=10)
    ws['A3'] = f'Édité le {datetime.now().strftime("%d/%m/%Y à %H:%M")}'
    ws['A3'].font = Font(color='64748B', size=9)

    ws['A5'] = 'Total encaissé'
    ws['B5'] = _m(dashboard.get('total_collected'))
    ws['A6'] = 'Dont espèces'
    ws['B6'] = _m(dashboard.get('cash_on_hand'))
    ws['A7'] = 'Remboursé'
    ws['B7'] = _m(dashboard.get('refunded_total'))
    missing_total = sum(
        (o.get('total_amount') or 0) - (o.get('collected') or 0) for o in missing
    )
    ws['A8'] = 'Encaissements manquants'
    ws['B8'] = _m(missing_total)
    for r in (5, 6, 7, 8):
        ws[f'A{r}'].font = TOTAL_FONT
        ws[f'B{r}'].font = TOTAL_FONT
        ws[f'B{r}'].number_format = MONEY_FMT
        ws[f'B{r}'].alignment = Alignment(horizontal='right')
        ws[f'A{r}'].fill = TOTAL_FILL
        ws[f'B{r}'].fill = TOTAL_FILL

    row = 10
    ws.cell(row=row, column=1, value='Par méthode').font = TITLE_FONT
    row += 1
    for idx, col in enumerate(['Méthode', 'Montant', 'Nombre'], start=1):
        cell = ws.cell(row=row, column=idx, value=col)
        cell.fill = HEADER_FILL
        cell.font = HEADER_FONT
    # cash_dashboard renvoie by_method sous forme de dict {methode: {...}}.
    by_method = dashboard.get('by_method') or {}
    for i, (method, entry) in enumerate(sorted(by_method.items()), start=row + 1):
        ws.cell(row=i, column=1, value=_safe(LABELS.get(method, method)))
        cell = ws.cell(row=i, column=2, value=_m(entry.get('amount')))
        cell.number_format = MONEY_FMT
        cell.alignment = Alignment(horizontal='right')
        ws.cell(row=i, column=3, value=entry.get('count', 0))
    for col, width in (('A', 32), ('B', 20), ('C', 12)):
        ws.column_dimensions[col].width = width

    _write_sheet(
        wb.create_sheet(), 'Journal', f'Journal des encaissements — {business_name}',
        JOURNAL_COLUMNS, journal_rows(journal),
        total_label='Total encaissé', total=dashboard.get('total_collected'),
    )
    _write_sheet(
        wb.create_sheet(), 'Encaissements manquants',
        f'Encaissements manquants — {business_name}',
        MISSING_COLUMNS, missing_rows(missing),
        total_label='Total manquant',
        total=sum(
            (o.get('total_amount') or 0) - (o.get('collected') or 0) for o in missing
        ),
    )

    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


# ══════════════════════════════════════════════════════════════════
# CSV
# ══════════════════════════════════════════════════════════════════

def build_csv(title, columns, rows) -> bytes:
    """CSV séparé par points-virgules : s'ouvre directement dans Excel FR.

    Le point-virgule évite qu'« 10 000,00 » soit lu comme deux colonnes.
    """
    buf = io.StringIO()
    writer = csv.writer(buf, delimiter=';', quoting=csv.QUOTE_MINIMAL)
    writer.writerow([_safe(title)])
    writer.writerow([f'Édité le {datetime.now().strftime("%d/%m/%Y %H:%M")}'])
    writer.writerow([])
    writer.writerow(columns)
    for data in rows:
        writer.writerow(data)
    # utf-8-sig : Excel reconnaît alors les accents sans manip manual.
    return buf.getvalue().encode('utf-8-sig')
