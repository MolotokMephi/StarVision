"""Regression tests: archival (deorbited) satellites must NOT appear in
live-propagation or link endpoints. Any jury who checks the catalog should
see Геоскан-Эдельвейс listed as archival, but find it filtered out of any
data that pretends to be real-time."""

import pytest
from httpx import AsyncClient, ASGITransport

from main import app
from satellites import RUSSIAN_CUBESATS

GEOSCAN_NORAD = 53385  # Геоскан-Эдельвейс, deorbited 2024-02-18.


@pytest.fixture
def transport():
    return ASGITransport(app=app)


@pytest.fixture
async def client(transport):
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


def test_catalog_still_has_archival_entry():
    # Catalog must still list Geoscan so the UI can explain its history.
    archival = [s for s in RUSSIAN_CUBESATS if s.status == "deorbited"]
    assert any(s.norad_id == GEOSCAN_NORAD for s in archival), (
        "Geoscan-Edelveis should remain in the catalog with status=deorbited"
    )


@pytest.mark.asyncio
async def test_positions_exclude_deorbited(client):
    resp = await client.get("/api/positions")
    assert resp.status_code == 200
    ids = {p["norad_id"] for p in resp.json()["positions"]}
    assert GEOSCAN_NORAD not in ids, (
        "deorbited satellites must not appear in /api/positions"
    )


@pytest.mark.asyncio
async def test_tle_embedded_excludes_deorbited(client):
    resp = await client.get("/api/tle?source=embedded")
    assert resp.status_code == 200
    body = resp.json()
    ids = {t["norad_id"] for t in body["tle_data"]}
    assert GEOSCAN_NORAD not in ids
    # Meta should match.
    meta = body["meta"]
    assert meta["operational_only"] is True
    assert meta["effective_source"] == "embedded"
    assert meta["total"] == len(body["tle_data"])


@pytest.mark.asyncio
async def test_orbit_for_archival_rejected_with_409(client):
    resp = await client.get(f"/api/orbit/{GEOSCAN_NORAD}")
    assert resp.status_code == 409
    assert "archival" in resp.json()["detail"].lower() or "deorbited" in resp.json()["detail"].lower()


@pytest.mark.asyncio
async def test_orbital_elements_for_archival_rejected_with_409(client):
    resp = await client.get(f"/api/orbital-elements/{GEOSCAN_NORAD}")
    assert resp.status_code == 409


@pytest.mark.asyncio
async def test_orbit_for_live_sat_still_works(client):
    live_id = next(s.norad_id for s in RUSSIAN_CUBESATS if s.status != "deorbited")
    resp = await client.get(f"/api/orbit/{live_id}?steps=10&step_sec=60")
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_links_exclude_deorbited(client):
    resp = await client.get("/api/links?comm_range_km=2000")
    assert resp.status_code == 200
    data = resp.json()
    ids_in_links = set()
    for lnk in data["links"]:
        ids_in_links.add(lnk["norad_id_1"])
        ids_in_links.add(lnk["norad_id_2"])
    assert GEOSCAN_NORAD not in ids_in_links


@pytest.mark.asyncio
async def test_health_reports_operational_counts(client):
    resp = await client.get("/api/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "ok"
    assert data["catalog"]["total"] == len(RUSSIAN_CUBESATS)
    assert data["catalog"]["archival"] >= 1
    assert data["catalog"]["operational"] + data["catalog"]["archival"] == data["catalog"]["total"]


@pytest.mark.asyncio
async def test_tle_meta_shape(client):
    resp = await client.get("/api/tle?source=embedded")
    data = resp.json()
    meta = data["meta"]
    for key in ("requested_source", "effective_source", "operational_only",
                "fetched_at", "cache_age_sec", "network_error",
                "fallback_count", "live_count", "total"):
        assert key in meta, f"meta missing {key}"
    assert meta["requested_source"] == "embedded"
    assert meta["network_error"] is False
