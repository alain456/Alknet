"""Réponses d'erreur API sans détail interne."""
import logging

from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import exception_handler

logger = logging.getLogger(__name__)


def api_exception_handler(exc, context):
    response = exception_handler(exc, context)
    if response is not None:
        return response
    logger.error('Erreur API non gérée', exc_info=exc)
    try:
        from config.metrics import incr
        incr('education_api_errors')
    except Exception:
        logger.exception('Compteur d’erreurs indisponible')
    return Response(
        {'detail': 'Erreur interne.'},
        status=status.HTTP_500_INTERNAL_SERVER_ERROR,
    )
