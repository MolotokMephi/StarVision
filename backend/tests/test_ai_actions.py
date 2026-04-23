"""Tests for StarAI action validation."""

from ai_assistant import validate_actions


def test_accepts_valid_actions():
    actions = [
        {"type": "focus_satellite", "norad_id": 46493},
        {"type": "set_time_speed", "speed": 50},
        {"type": "toggle_orbits", "visible": True},
        {"type": "reset_view"},
    ]
    accepted, rejected = validate_actions(actions)
    assert len(accepted) == 4
    assert rejected == []


def test_rejects_archival_norad():
    actions = [{"type": "focus_satellite", "norad_id": 53385}]  # Geoscan-Edelveis (deorbited)
    accepted, rejected = validate_actions(actions)
    assert accepted == []
    assert rejected and "archival" in rejected[0]


def test_rejects_unknown_norad():
    actions = [{"type": "focus_satellite", "norad_id": 99999}]
    accepted, rejected = validate_actions(actions)
    assert accepted == []
    assert rejected


def test_rejects_unknown_action():
    actions = [{"type": "launch_rocket"}]
    accepted, rejected = validate_actions(actions)
    assert accepted == []
    assert rejected and "unknown action" in rejected[0]


def test_clamps_out_of_range_speed():
    accepted, _ = validate_actions([{"type": "set_time_speed", "speed": 999}])
    assert accepted == [{"type": "set_time_speed", "speed": 200}]
    accepted, _ = validate_actions([{"type": "set_time_speed", "speed": 0}])
    assert accepted == [{"type": "set_time_speed", "speed": 1}]


def test_clamps_satellite_count():
    accepted, _ = validate_actions([{"type": "set_satellite_count", "count": 100}])
    assert accepted == [{"type": "set_satellite_count", "count": 15}]
    accepted, _ = validate_actions([{"type": "set_satellite_count", "count": 1}])
    assert accepted == [{"type": "set_satellite_count", "count": 3}]


def test_rejects_unknown_constellation():
    accepted, rejected = validate_actions([
        {"type": "highlight_constellation", "name": "Starlink"}
    ])
    assert accepted == []
    assert rejected


def test_bool_type_enforced_for_toggles():
    accepted, rejected = validate_actions([
        {"type": "toggle_links", "visible": "yes"}
    ])
    assert accepted == []
    assert rejected


def test_orbit_altitude_zero_preserved():
    accepted, _ = validate_actions([{"type": "set_orbit_altitude", "altitude_km": 0}])
    assert accepted == [{"type": "set_orbit_altitude", "altitude_km": 0}]


def test_orbit_altitude_clamped():
    accepted, _ = validate_actions([{"type": "set_orbit_altitude", "altitude_km": 100}])
    # Below min 400 with alt > 0 → clamped to 400
    assert accepted == [{"type": "set_orbit_altitude", "altitude_km": 400}]


def test_caps_max_actions():
    actions = [{"type": "reset_view"}] * 20
    accepted, rejected = validate_actions(actions)
    assert len(accepted) == 8
    assert rejected and "dropped" in rejected[-1]


def test_non_list_input():
    accepted, rejected = validate_actions("not a list")  # type: ignore[arg-type]
    assert accepted == []
    assert rejected
