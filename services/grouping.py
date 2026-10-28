"""Un seul groupement d’offres : Service.parent / grouped_services."""


def drop_obsolete_parent_items(offer):
    """
    Si un service a déjà de vrais sous-services (enfants),
    les anciennes lignes ServiceSubItem du parent ne servent plus au groupement.
    Les précisions restent sur les enfants.
    """
    if not offer or offer.parent_id:
        return offer
    if not offer.grouped_services.exists():
        return offer
    leftover = offer.sub_items.all()
    if leftover.exists():
        leftover.delete()
    return offer
