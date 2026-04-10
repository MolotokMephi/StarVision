"""Tests for main.py — FastAPI endpoints."""

import pytest
from httpx import AsyncClient, ASGITransport

from main import app


@pytest.fixture
def transport():
    return ASGITransport(app=app)


@pytest.fixture
async def client(transport):
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest.mark.asyncio
async def test_root(client):
    resp = await client.get("/")
    assert resp.status_code == 200
    data = resp.json()
    assert data["project"] == "StarVision"
    assert "version" in data


@pytest.mark.asyncio
async def test_list_satellites(client):
    resp = await client.get("/api/satellites")
    assert resp.status_code == 200
    data = resp.json()
    assert "satellites" in data
    assert data["count"] == 15
    assert len(data["satellites"]) == 15


@pytest.mark.asyncio
async def test_get_satellite_found(client):
    resp = await client.get("/api/satellites/46493")
    assert resp.status_code == 200
    data = resp.json()
    assert data["norad_id"] == 46493
    assert data["name"] == "Декарт"


@pytest.mark.asyncio
async def test_get_satellite_not_found(client):
    resp = await client.get("/api/satellites/99999")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_get_tle_embedded(client):
    resp = await client.get("/api/tle?source=embedded")
    assert resp.status_code == 200
    data = resp.json()
    assert data["source"] == "embedded"
    assert "tle_data" in data
    assert len(data["tle_data"]) > 0


@pytest.mark.asyncio
async def test_get_tle_invalid_source(client):
    resp = await client.get("/api/tle?source=invalid")
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_get_positions(client):
    resp = await client.get("/api/positions")
    assert resp.status_code == 200
    data = resp.json()
    assert "positions" in data
    assert len(data["positions"]) > 0
    pos = data["positions"][0]
    assert "eci" in pos
    assert "altitude_km" in pos


@pytest.mark.asyncio
async def test_get_positions_with_timestamp(client):
    resp = await client.get("/api/positions?timestamp=2026-04-01T12:00:00Z")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["positions"]) > 0


@pytest.mark.asyncio
async def test_get_positions_invalid_timestamp(client):
    resp = await client.get("/api/positions?timestamp=not-a-date")
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_get_orbit_path(client):
    resp = await client.get("/api/orbit/46493?steps=10&step_sec=60")
    assert resp.status_code == 200
    data = resp.json()
    assert data["norad_id"] == 46493
    assert len(data["path"]) == 10


@pytest.mark.asyncio
async def test_get_orbit_path_not_found(client):
    resp = await client.get("/api/orbit/99999")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_get_orbital_elements(client):
    resp = await client.get("/api/orbital-elements/46493")
    assert resp.status_code == 200
    data = resp.json()
    assert "inclination_deg" in data
    assert "eccentricity" in data
    assert "semi_major_axis_km" in data


@pytest.mark.asyncio
async def test_get_links(client):
    resp = await client.get("/api/links?comm_range_km=2000")
    assert resp.status_code == 200
    data = resp.json()
    assert "links" in data
    assert "active_count" in data
    assert "total_pairs" in data
    assert data["comm_range_km"] == 2000.0


@pytest.mark.asyncio
async def test_get_links_range_validation(client):
    # Above max (2000)
    resp = await client.get("/api/links?comm_range_km=5000")
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_get_collisions(client):
    resp = await client.get("/api/collisions?threshold_km=100&hours_ahead=1")
    assert resp.status_code == 200
    data = resp.json()
    assert "close_approaches" in data
    assert isinstance(data["close_approaches"], list)


@pytest.mark.asyncio
async def test_optimize_planes(client):
    resp = await client.get("/api/optimize-planes?num_satellites=12&num_planes=3&altitude_km=550")
    assert resp.status_code == 200
    data = resp.json()
    assert data["walker_notation"] == "12/3/1"
    assert len(data["planes"]) == 3


@pytest.mark.asyncio
async def test_get_config(client):
    resp = await client.get("/api/config")
    assert resp.status_code == 200
    data = resp.json()
    assert data["earth_radius_km"] == 6371.0
    assert "constellations" in data
    assert len(data["constellations"]) == 6
