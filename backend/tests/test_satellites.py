"""Tests for satellites.py — Russian CubeSat catalog."""

from satellites import (
    RUSSIAN_CUBESATS, SatelliteInfo,
    get_all_satellites, get_satellite_by_id, get_tle_data,
)


class TestSatelliteCatalog:
    """Catalog integrity checks."""

    def test_catalog_has_15_entries(self):
        assert len(RUSSIAN_CUBESATS) == 15

    def test_all_entries_are_satellite_info(self):
        for sat in RUSSIAN_CUBESATS:
            assert isinstance(sat, SatelliteInfo)

    def test_norad_ids_are_unique(self):
        ids = [s.norad_id for s in RUSSIAN_CUBESATS]
        assert len(ids) == len(set(ids))

    def test_all_have_required_fields(self):
        for sat in RUSSIAN_CUBESATS:
            assert sat.norad_id > 0
            assert len(sat.name) > 0
            assert len(sat.constellation) > 0
            assert sat.mass_kg > 0
            assert sat.form_factor in ("1U", "1.5U", "3U", "6U")
            assert sat.status in ("active", "inactive", "deorbited")

    def test_constellations_are_known(self):
        known = {"УниверСат", "МГТУ Баумана", "SPUTNIX", "Геоскан", "НИИЯФ МГУ", "Space-Pi"}
        for sat in RUSSIAN_CUBESATS:
            assert sat.constellation in known, f"{sat.name} has unknown constellation: {sat.constellation}"

    def test_active_satellites_have_tle(self):
        for sat in RUSSIAN_CUBESATS:
            if sat.status == "active":
                assert sat.tle_line1.startswith("1 "), f"{sat.name}: bad TLE line 1"
                assert sat.tle_line2.startswith("2 "), f"{sat.name}: bad TLE line 2"

    def test_tle_line_lengths(self):
        for sat in RUSSIAN_CUBESATS:
            if sat.tle_line1:
                assert len(sat.tle_line1) == 69, f"{sat.name}: TLE line 1 length = {len(sat.tle_line1)}"
                assert len(sat.tle_line2) == 69, f"{sat.name}: TLE line 2 length = {len(sat.tle_line2)}"

    def test_exactly_one_deorbited(self):
        deorbited = [s for s in RUSSIAN_CUBESATS if s.status == "deorbited"]
        assert len(deorbited) == 1
        assert deorbited[0].name == "Геоскан-Эдельвейс"


class TestGetAllSatellites:
    def test_returns_list_of_dicts(self):
        result = get_all_satellites()
        assert isinstance(result, list)
        assert len(result) == 15
        for item in result:
            assert isinstance(item, dict)
            assert "norad_id" in item
            assert "name" in item
            assert "constellation" in item

    def test_dict_keys(self):
        item = get_all_satellites()[0]
        expected_keys = {
            "norad_id", "name", "constellation", "purpose",
            "mass_kg", "form_factor", "launch_date", "status",
            "operational", "archive_date", "description",
        }
        assert set(item.keys()) == expected_keys

    def test_operational_flag(self):
        items = get_all_satellites()
        for item in items:
            assert item["operational"] == (item["status"] == "active")
        # exactly one deorbited satellite
        archival = [i for i in items if not i["operational"]]
        assert len(archival) == 1
        assert archival[0]["status"] == "deorbited"
        assert archival[0]["archive_date"] == "2024-02-18"


class TestGetSatelliteById:
    def test_find_existing(self):
        sat = get_satellite_by_id(46493)
        assert sat is not None
        assert sat.name == "Декарт"
        assert sat.constellation == "УниверСат"

    def test_find_nonexistent(self):
        assert get_satellite_by_id(99999) is None

    def test_find_deorbited(self):
        sat = get_satellite_by_id(53385)
        assert sat is not None
        assert sat.status == "deorbited"


class TestGetTleData:
    def test_excludes_deorbited(self):
        tle_list = get_tle_data()
        norad_ids = [item["norad_id"] for item in tle_list]
        # Geoscan-Edelveis (53385) is deorbited — must be excluded
        assert 53385 not in norad_ids

    def test_active_satellites_present(self):
        tle_list = get_tle_data()
        norad_ids = [item["norad_id"] for item in tle_list]
        assert 46493 in norad_ids  # Dekart
        assert 46490 in norad_ids  # Yarilo-1

    def test_tle_data_shape(self):
        tle_list = get_tle_data()
        for item in tle_list:
            assert "norad_id" in item
            assert "name" in item
            assert "constellation" in item
            assert "tle_line1" in item
            assert "tle_line2" in item
            assert item["tle_line1"].startswith("1 ")
            assert item["tle_line2"].startswith("2 ")
