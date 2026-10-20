import base64
import tempfile
from io import BytesIO
from pathlib import Path

from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from PIL import Image
from rest_framework.exceptions import ValidationError
from rest_framework.test import APIClient

from profiles.images import assign_person_photo, store_profile_image

User = get_user_model()


def _jpeg_data_url(width, height, color):
    image = Image.new('RGB', (width, height), color)
    buffer = BytesIO()
    image.save(buffer, format='JPEG')
    encoded = base64.b64encode(buffer.getvalue()).decode()
    return f'data:image/jpeg;base64,{encoded}'


class ProfileImageTests(TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.media = Path(self.tmp.name)
        self.override = override_settings(MEDIA_ROOT=self.media)
        self.override.enable()
        self.user = User.objects.create_user(
            email='photo@example.com',
            password='secret-pass-1',
            first_name='Aline',
            last_name='Nday',
        )

    def tearDown(self):
        self.override.disable()
        self.tmp.cleanup()

    def test_avatar_is_a_square_public_file(self):
        url = assign_person_photo(self.user, _jpeg_data_url(80, 40, (10, 20, 30)))
        self.assertTrue(url.startswith('/media/public/profiles/avatars/'))
        self.user.profile.refresh_from_db()
        self.assertEqual(self.user.profile.avatar, url)
        stored = Image.open(self.media / url.removeprefix('/media/'))
        self.assertEqual(stored.size[0], stored.size[1])

        client = APIClient()
        response = client.get(url)
        self.assertEqual(response.status_code, 200)

    def test_rejects_svg_and_keeps_logo_proportions(self):
        with self.assertRaises(ValidationError):
            store_profile_image('data:image/svg+xml;base64,PHN2Zy8+', kind='logo', key='bad')

        url = store_profile_image(_jpeg_data_url(100, 40, (1, 2, 3)), kind='logo', key='shop')
        stored = Image.open(self.media / url.removeprefix('/media/'))
        self.assertGreater(stored.size[0], stored.size[1])
