from tests.conftest import login, make_user


def test_login_and_me(client, admin):
    me = client.get("/api/auth/me", headers=admin).json()
    assert me["email"] == "admin@test.com"
    assert me["role"] == "admin"
    assert me["createdAt"].endswith("Z")


def test_wrong_password_and_unknown_email_look_the_same(client):
    make_user()
    a = client.post("/api/auth/login", json={"email": "admin@test.com", "password": "nope-nope"})
    b = client.post("/api/auth/login", json={"email": "ghost@test.com", "password": "nope-nope"})
    assert a.status_code == b.status_code == 401
    assert a.json() == b.json()


def test_lockout_after_five_failures(client):
    make_user()
    codes = [client.post("/api/auth/login", json={"email": "admin@test.com", "password": "wrong-pass"}).status_code for _ in range(6)]
    assert codes == [401] * 5 + [429]
    # Locked even with the right password until the lock expires.
    assert client.post("/api/auth/login", json={"email": "admin@test.com", "password": "admin-pass-1"}).status_code == 429


def test_requires_token(client):
    assert client.get("/api/customers").status_code == 401
    assert client.get("/api/customers", headers={"Authorization": "Bearer forged.token.value"}).status_code == 401


def test_staff_cannot_manage_users(client, staff):
    assert client.get("/api/users", headers=staff).status_code == 403
    assert client.get("/api/customers", headers=staff).status_code == 200


def test_disabled_user_is_locked_out_immediately(client, admin, staff):
    staff_id = client.get("/api/auth/me", headers=staff).json()["id"]
    assert client.patch(f"/api/users/{staff_id}", headers=admin, json={"isActive": False}).status_code == 200
    assert client.get("/api/auth/me", headers=staff).status_code == 401


def test_last_admin_is_protected(client, admin):
    me = client.get("/api/auth/me", headers=admin).json()
    assert client.patch(f"/api/users/{me['id']}", headers=admin, json={"role": "staff"}).status_code == 400


def test_change_password(client, admin):
    bad = client.post("/api/auth/change-password", headers=admin, json={"currentPassword": "x", "newPassword": "brand-new-1"})
    assert bad.status_code == 400
    ok = client.post("/api/auth/change-password", headers=admin, json={"currentPassword": "admin-pass-1", "newPassword": "brand-new-1"})
    assert ok.status_code == 204
    login(client, "admin@test.com", "brand-new-1")
