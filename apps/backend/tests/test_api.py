"""API tests"""


def test_health(client):
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_get_cards_empty(client):
    """A fresh catalog returns an empty list under the `cards` envelope."""
    response = client.get("/cards")
    assert response.status_code == 200
    assert response.json() == {"cards": []}
