import requests
import json
import random

BASE_URL = "http://localhost:8000/api/v1"

def print_response(title, response):
    print(f"\n--- {title} ---")
    print(f"Status: {response.status_code}")
    try:
        print(json.dumps(response.json(), indent=2))
    except:
        print(response.text)

def main():
    # 1. Inscription d'un Propriétaire d'Entreprise
    owner_email = f"owner_{random.randint(1000,9999)}@alknet.com"
    res = requests.post(f"{BASE_URL}/accounts/register/", data={
        "email": owner_email,
        "password": "SuperStrongPassw0rd!2026",
        "role": "BUSINESS_OWNER"
    })
    print_response("Register Business Owner", res)

    # 2. Inscription d'un Professionnel (Candidat)
    prof_email = f"prof_{random.randint(1000,9999)}@alknet.com"
    res = requests.post(f"{BASE_URL}/accounts/register/", data={
        "email": prof_email,
        "password": "SuperStrongPassw0rd!2026",
        "role": "PROFESSIONAL"
    })
    print_response("Register Professional", res)

    # 3. Connexion (Login) pour récupérer les Tokens JWT
    owner_login = requests.post(f"{BASE_URL}/accounts/login/", data={"email": owner_email, "password": "SuperStrongPassw0rd!2026"})
    owner_token = owner_login.json().get("access")
    owner_headers = {"Authorization": f"Bearer {owner_token}"}
    
    prof_login = requests.post(f"{BASE_URL}/accounts/login/", data={"email": prof_email, "password": "SuperStrongPassw0rd!2026"})
    prof_token = prof_login.json().get("access")
    prof_headers = {"Authorization": f"Bearer {prof_token}"}

    # (Note: Normalement, seul le SuperAdmin peut créer une catégorie, on va supposer que c'est fait ou utiliser une catégorie existante si possible. Pour simplifier, on va créer le Business sans catégorie s'il est nullable, ou récupérer la première catégorie disponible).
    categories_res = requests.get(f"{BASE_URL}/business-categories/")
    category_id = None
    if categories_res.status_code == 200 and categories_res.json():
        category_id = categories_res.json()[0]['id']

    # 4. Création d'une Entreprise par le propriétaire
    business_data = {
        "name": "Alknet Tech Solutions",
        "description": "Développement logiciel",
    }
    if category_id:
        business_data['category'] = category_id

    res = requests.post(f"{BASE_URL}/businesses/me/", headers=owner_headers, data=business_data)
    print_response("Create Business", res)
    
    if res.status_code != 201:
        print("Arrêt du test car l'entreprise n'a pas pu être créée.")
        return
        
    business_id = res.json()['id']

    # 5. Publication d'une Offre par l'Entreprise
    offer_data = {
        "business": business_id,
        "title": "Développeur Python/Django Senior",
        "description": "Nous cherchons un dev pour construire notre SaaS.",
        "offer_type": "FULL_TIME",
        "salary_range": "2500$ - 3500$",
        "location": "Télétravail"
    }
    # Pour envoyer du JSON (à cause des required_skills en liste), on utilise json= et les bons headers
    offer_headers = owner_headers.copy()
    offer_headers['Content-Type'] = 'application/json'
    offer_data['required_skills'] = ["Python", "Django", "PostgreSQL"]

    res = requests.post(f"{BASE_URL}/offers/my-business/", headers=offer_headers, json=offer_data)
    print_response("Create Offer", res)
    
    if res.status_code != 201:
        print("Arrêt du test car l'offre n'a pas pu être créée.")
        return
        
    offer_id = res.json()['id']

    # 6. Le Professionnel parcourt les offres publiques
    res = requests.get(f"{BASE_URL}/offers/")
    print_response("Public Offers List", res)

    # 7. Le Professionnel postule à l'Offre
    res = requests.post(f"{BASE_URL}/offers/{offer_id}/apply/", headers=prof_headers, data={
        "cover_letter": "Bonjour, je suis très intéressé par ce poste et j'ai 5 ans d'expérience."
    })
    print_response("Apply to Offer", res)

    # 8. L'Entreprise vérifie les candidatures reçues
    res = requests.get(f"{BASE_URL}/offers/my-business/applications/", headers=owner_headers)
    print_response("View Received Applications", res)

if __name__ == "__main__":
    main()
