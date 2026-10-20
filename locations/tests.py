from urllib.error import HTTPError
from unittest.mock import patch

from django.test import RequestFactory, SimpleTestCase

from education.geo import road_distance
from locations.maps_link import extract_coordinates, resolve_maps_link
from locations.views import maps_link


class MapLinkTests(SimpleTestCase):
    def test_pin_wins_over_camera(self):
        text = 'https://www.google.com/maps/place/Bujumbura/@-3.36,29.35,13z/data=!3d-3.3791592!4d29.3746811'
        self.assertEqual(extract_coordinates(text), ('-3.3791592', '29.3746811'))

    def test_plain_pair(self):
        self.assertEqual(extract_coordinates('-3.3791592, 29.3746811'), ('-3.3791592', '29.3746811'))

    def test_short_link_follows_google_redirect(self):
        error = HTTPError(
            'https://maps.app.goo.gl/abc',
            302,
            'Found',
            hdrs={'Location': 'https://www.google.com/maps/place/X/@-3.3821049,29.3583212,17z'},
            fp=None,
        )
        with patch('urllib.request.build_opener') as build:
            build.return_value.open.side_effect = error
            found = resolve_maps_link('https://maps.app.goo.gl/abc')
        self.assertEqual(found, ('-3.3821049', '29.3583212'))

    def test_foreign_host_is_refused(self):
        with self.assertRaises(ValueError):
            resolve_maps_link('https://example.com/maps/place/Bujumbura')

    def test_view_returns_coordinates(self):
        request = RequestFactory().get(
            '/api/v1/locations/maps-link/',
            {'url': 'https://www.google.com/maps?q=-3.3731,29.9189'},
        )
        response = maps_link(request)
        self.assertEqual(response.status_code, 200)
        self.assertIn(b'-3.3731', response.content)


class StraightLineDistanceTests(SimpleTestCase):
    def test_router_failure_returns_straight_line(self):
        with patch('urllib.request.urlopen', side_effect=OSError('réseau inaccessible')):
            result = road_distance(-3.39, 29.36, -3.3821049, 29.3583212)
        self.assertEqual(result['kind'], 'straight')
        self.assertIsNone(result['duration_minutes'])
        self.assertGreater(result['distance_km'], 0.5)
        self.assertLess(result['distance_km'], 2)
