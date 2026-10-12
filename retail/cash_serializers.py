"""Serializers de la caisse : journal d'encaissements et vue de suivi."""
from rest_framework import serializers

from orders.models import CashCollection


class CashCollectionSerializer(serializers.ModelSerializer):
    source_display = serializers.CharField(source='get_source_display', read_only=True)
    method_display = serializers.CharField(source='get_method_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    received_by_name = serializers.SerializerMethodField()
    signed_amount = serializers.DecimalField(
        max_digits=14, decimal_places=2, read_only=True)

    def get_received_by_name(self, obj):
        user = obj.received_by
        if not user:
            return ''
        return user.get_full_name() or user.email

    class Meta:
        model = CashCollection
        fields = [
            'id', 'source', 'source_display', 'source_order_ref', 'amount',
            'signed_amount', 'currency', 'method', 'method_display', 'status',
            'status_display', 'external_reference', 'customer_name', 'note',
            'received_by', 'received_by_name', 'collected_at',
        ]
        read_only_fields = [
            'id', 'source', 'source_order_ref', 'signed_amount', 'status_display',
            'received_by', 'received_by_name', 'collected_at',
        ]


class CashMethodTotalSerializer(serializers.Serializer):
    """Une ligne du tableau de bord : total encaissé par méthode de paiement."""
    method = serializers.CharField()
    label = serializers.CharField()
    amount = serializers.DecimalField(max_digits=14, decimal_places=2)
    count = serializers.IntegerField()


class CashDashboardSerializer(serializers.Serializer):
    """Suivi de l'argent encaissé sur une période."""
    total_collected = serializers.DecimalField(max_digits=14, decimal_places=2)
    cash_on_hand = serializers.DecimalField(max_digits=14, decimal_places=2)
    refunded_total = serializers.DecimalField(max_digits=14, decimal_places=2)
    by_method = CashMethodTotalSerializer(many=True)
    currency = serializers.CharField(default='BIF')
    since = serializers.DateTimeField()
    until = serializers.DateTimeField()


class CashReconciliationAnomalySerializer(serializers.Serializer):
    type = serializers.CharField()
    source = serializers.CharField()
    order_id = serializers.CharField()
    reference = serializers.CharField()
    amount = serializers.DecimalField(max_digits=14, decimal_places=2, required=False)
    message = serializers.CharField()


class CashReconciliationSerializer(serializers.Serializer):
    """Écarts entre ce que les commandes affirment et ce que la caisse a vu."""
    clean = serializers.BooleanField()
    count = serializers.IntegerField()
    anomalies = CashReconciliationAnomalySerializer(many=True)
    since = serializers.DateTimeField()
