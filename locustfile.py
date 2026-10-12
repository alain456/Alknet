"""Charge légère sur les routes publiques d'inscription.

Lancement : locust -f locustfile.py --headless -u 5 -r 1 -t 30s --host http://127.0.0.1:8000
"""
from locust import HttpUser, between, task


class EnrollmentPublicUser(HttpUser):
    wait_time = between(0.5, 1.5)

    @task(3)
    def distance(self):
        self.client.get(
            '/api/v1/education/distance/',
            params={
                'from_lat': '-3.38',
                'from_lng': '29.36',
                'to_lat': '-3.39',
                'to_lng': '29.37',
            },
            name='/education/distance',
        )

    @task(2)
    def track_unknown(self):
        self.client.get(
            '/api/v1/education/applications/suivi/',
            params={'token': 'charge-test'},
            name='/education/applications/suivi',
        )

    @task(1)
    def apply_unknown_campaign(self):
        self.client.post(
            '/api/v1/education/applications/apply/',
            json={'campaign': '00000000-0000-0000-0000-000000000000'},
            name='/education/applications/apply',
        )
