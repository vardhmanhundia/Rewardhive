"""Tests for authentication endpoints"""

from fastapi.testclient import TestClient


def test_signup_success(client: TestClient, test_user_data: dict):
    """Test successful user signup"""
    response = client.post("/auth/signup", json=test_user_data)

    assert response.status_code == 201
    data = response.json()
    assert data["access_token"]
    assert data["token_type"] == "bearer"
    assert data["user"]["email"] == test_user_data["email"]
    assert data["user"]["first_name"] == test_user_data["first_name"]
    assert data["user"]["last_name"] == test_user_data["last_name"]


def test_signup_duplicate_email(client: TestClient, test_user_data: dict):
    """Test signup with duplicate email"""
    # First signup
    client.post("/auth/signup", json=test_user_data)

    # Second signup with same email
    response = client.post("/auth/signup", json=test_user_data)

    assert response.status_code == 409
    assert "already exists" in response.json()["detail"]


def test_signup_invalid_email(client: TestClient, test_user_data: dict):
    """Test signup with invalid email"""
    test_user_data["email"] = "invalid-email"
    response = client.post("/auth/signup", json=test_user_data)

    assert response.status_code == 422


def test_signup_short_password(client: TestClient, test_user_data: dict):
    """Test signup with password too short"""
    test_user_data["password"] = "short"
    response = client.post("/auth/signup", json=test_user_data)

    assert response.status_code == 422


def test_signup_missing_fields(client: TestClient):
    """Test signup with missing required fields"""
    response = client.post("/auth/signup", json={})

    assert response.status_code == 422


def test_login_success(client: TestClient, test_user_data: dict):
    """Test successful login"""
    # Create user
    client.post("/auth/signup", json=test_user_data)

    # Login
    response = client.post(
        "/auth/login",
        json={
            "email": test_user_data["email"],
            "password": test_user_data["password"],
        },
    )

    assert response.status_code == 200
    data = response.json()
    assert data["access_token"]
    assert data["token_type"] == "bearer"
    assert data["user"]["email"] == test_user_data["email"]


def test_login_invalid_password(client: TestClient, test_user_data: dict):
    """Test login with invalid password"""
    # Create user
    client.post("/auth/signup", json=test_user_data)

    # Login with wrong password
    response = client.post(
        "/auth/login",
        json={
            "email": test_user_data["email"],
            "password": "wrongpassword",
        },
    )

    assert response.status_code == 401
    assert "Invalid email or password" in response.json()["detail"]


def test_login_nonexistent_user(client: TestClient):
    """Test login with non-existent email"""
    response = client.post(
        "/auth/login",
        json={
            "email": "nonexistent@example.com",
            "password": "password123",
        },
    )

    assert response.status_code == 401
    assert "Invalid email or password" in response.json()["detail"]


def test_get_profile_success(client: TestClient, test_user_data: dict):
    """Test getting user profile with valid token"""
    # Create user
    signup_response = client.post("/auth/signup", json=test_user_data)
    token = signup_response.json()["access_token"]

    # Get profile
    response = client.get(
        "/auth/profile",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["email"] == test_user_data["email"]
    assert data["first_name"] == test_user_data["first_name"]
    assert data["last_name"] == test_user_data["last_name"]


def test_get_profile_without_token(client: TestClient):
    """Test getting profile without authorization header"""
    response = client.get("/auth/profile")

    assert response.status_code == 401
    assert "Missing authorization header" in response.json()["detail"]


def test_get_profile_with_invalid_token(client: TestClient):
    """Test getting profile with invalid token"""
    response = client.get(
        "/auth/profile",
        headers={"Authorization": "Bearer invalid_token"},
    )

    assert response.status_code == 401


def test_get_profile_with_malformed_header(client: TestClient):
    """Test getting profile with malformed authorization header"""
    response = client.get(
        "/auth/profile",
        headers={"Authorization": "InvalidFormat"},
    )

    assert response.status_code == 401
    assert "Invalid authorization header format" in response.json()["detail"]


def test_logout_success(client: TestClient, test_user_data: dict):
    """Test successful logout"""
    # Create user
    signup_response = client.post("/auth/signup", json=test_user_data)
    token = signup_response.json()["access_token"]

    # Logout
    response = client.post(
        "/auth/logout",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_logout_without_token(client: TestClient):
    """Test logout without token"""
    response = client.post("/auth/logout")

    assert response.status_code == 401


def test_access_token_contains_user_info(client: TestClient, test_user_data: dict):
    """Test that access token contains user information"""
    import jwt

    from src.config import settings

    # Create user
    signup_response = client.post("/auth/signup", json=test_user_data)
    token = signup_response.json()["access_token"]

    # Decode token with the same secret/algorithm the app signed it with
    decoded = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])

    assert "sub" in decoded  # user_id
    assert "email" in decoded
    assert decoded["email"] == test_user_data["email"]


def test_facebook_login_invalid_token(client: TestClient, monkeypatch):
    """Test Facebook login with invalid token"""
    from unittest.mock import AsyncMock

    from src.services.social_auth_service import SocialAuthService

    # Mock Facebook token verification to return None
    monkeypatch.setattr(
        SocialAuthService, "verify_facebook_token", AsyncMock(return_value=None)
    )

    response = client.post(
        "/auth/facebook/login",
        json={
            "access_token": "invalid_token",
            "email": "test@example.com",
            "first_name": "John",
            "last_name": "Doe",
        },
    )

    assert response.status_code == 401
    assert "Invalid Facebook token" in response.json()["detail"]


def test_facebook_login_new_user(client: TestClient, monkeypatch):
    """Test Facebook login creating a new user"""
    from unittest.mock import AsyncMock

    from src.services.social_auth_service import SocialAuthService

    facebook_data = {
        "facebook_id": "123456789",
        "email": "fbuser@example.com",
        "first_name": "Facebook",
        "last_name": "User",
    }

    # Mock Facebook token verification
    monkeypatch.setattr(
        SocialAuthService,
        "verify_facebook_token",
        AsyncMock(return_value=facebook_data),
    )

    response = client.post(
        "/auth/facebook/login",
        json={
            "access_token": "valid_token",
            "email": "fbuser@example.com",
            "first_name": "Facebook",
            "last_name": "User",
        },
    )

    assert response.status_code == 201
    data = response.json()
    assert data["access_token"]
    assert data["token_type"] == "bearer"
    assert data["user"]["email"] == "fbuser@example.com"
    assert data["user"]["first_name"] == "Facebook"
    assert data["user"]["last_name"] == "User"


def test_facebook_login_existing_user(client: TestClient, monkeypatch, test_user_data: dict):
    """Test Facebook login with existing user by email"""
    from unittest.mock import AsyncMock

    from src.services.social_auth_service import SocialAuthService

    # First create a regular user
    client.post("/auth/signup", json=test_user_data)

    facebook_data = {
        "facebook_id": "987654321",
        "email": test_user_data["email"],
        "first_name": test_user_data["first_name"],
        "last_name": test_user_data["last_name"],
    }

    # Mock Facebook token verification
    monkeypatch.setattr(
        SocialAuthService,
        "verify_facebook_token",
        AsyncMock(return_value=facebook_data),
    )

    # Login with Facebook (same email)
    response = client.post(
        "/auth/facebook/login",
        json={
            "access_token": "valid_token",
            "email": test_user_data["email"],
            "first_name": test_user_data["first_name"],
            "last_name": test_user_data["last_name"],
        },
    )

    assert response.status_code == 201
    data = response.json()
    assert data["user"]["email"] == test_user_data["email"]
