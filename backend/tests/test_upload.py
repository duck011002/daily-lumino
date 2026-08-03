import pytest
from fastapi import HTTPException

from app.services.upload import lsky_upload_url, public_image_url


def test_lsky_upload_url_accepts_api_base_url():
    assert lsky_upload_url("http://127.0.0.1:40027/api") == (
        "http://127.0.0.1:40027/api/v1/upload"
    )


def test_lsky_upload_url_accepts_host_base_url():
    assert lsky_upload_url("http://127.0.0.1:40027") == (
        "http://127.0.0.1:40027/api/v1/upload"
    )


def test_public_image_url_rewrites_private_lsky_host():
    assert public_image_url(
        "http://10.0.0.5:40027/i/photo.png?style=large",
        "https://img.example.com/media",
    ) == "https://img.example.com/media/i/photo.png?style=large"


def test_public_image_url_keeps_an_absolute_https_url_unchanged():
    url = "https://lsky.example/i/photo.png?style=large"
    assert public_image_url(url, "https://img.example.com/media") == url


def test_public_image_url_requires_https_without_public_domain():
    with pytest.raises(HTTPException, match="非 HTTPS"):
        public_image_url("http://10.0.0.5:40027/i/photo.png")


def test_public_image_url_rejects_non_https_public_domain():
    with pytest.raises(HTTPException, match="HTTPS"):
        public_image_url("http://lsky.example/i/photo.png", "http://img.example.com")


def test_lsky_upload_url_accepts_a_complete_upload_endpoint():
    assert lsky_upload_url("https://lsky.example/api/v1/upload") == (
        "https://lsky.example/api/v1/upload"
    )
