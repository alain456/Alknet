"""
Compatibilité rétroactive — utiliser businesses.burundipay.

Ce module réexporte l'API BurundiPay pour ne pas casser d'anciens imports.
"""
from .burundipay import (  # noqa: F401
    LEGACY_PAYMENT_METHODS,
    PAYMENT_METHOD,
    check_collection_status,
    initiate_collection,
    is_burundipay_method,
    is_stub_mode,
    merchant_account,
    normalize_phone,
    refund_collection,
)
