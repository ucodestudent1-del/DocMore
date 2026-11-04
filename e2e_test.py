import urllib.request, json

BASE = "http://localhost:8000/api"

def req(method, path, payload=None, token=None):
    data = json.dumps(payload).encode() if payload else None
    r = urllib.request.Request(BASE + path, data=data, method=method,
                               headers={"Content-Type": "application/json"})
    if token:
        r.add_header("Authorization", "Bearer " + token)
    return urllib.request.urlopen(r).read().decode()

# Register
print("REGISTER:", req("POST", "/auth/register", {
    "username": "investor", "email": "investor@test.com", "password": "testpass123"}))
# Login
login = json.loads(req("POST", "/auth/token", {"username": "investor", "password": "testpass123"}))
token = login["access_token"]
print("TOKEN:", token[:20] + "...")
# Analyze
print("ANALYZE:", req("POST", "/analyze", {
    "purchase_price": 300000, "rental_income": 2500, "down_payment": 60000,
    "loan_term_years": 30, "interest_rate": 6.5, "property_tax_annual": 4200,
    "insurance_annual": 1800, "misc_opex_annual": 3000}, token=token))
# List analyses
print("LIST:", req("GET", "/analyses", token=token))
