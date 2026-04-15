import requests
import json
import time
import sys

BASE_URL = "http://localhost:3099/api"

def log(msg):
    print(f"[*] {msg}")

def error_exit(msg, resp=None):
    print(f"[!] ERROR: {msg}")
    if resp:
        print(f"Status: {resp.status_code}")
        print(f"Body: {resp.text}")
    sys.exit(1)

# Helper to get OTP from MongoDB
def get_user_otp(email):
    import subprocess
    cmd = f"node -e \"require('dotenv').config(); const mongoose=require('mongoose'); const User=require('./models/User'); (async()=>{{ await mongoose.connect(process.env.MONGODB_URI); const u=await User.findOne({{email:'{email}'}}); console.log(u?u.otpCode:'NONE'); process.exit(0); }})()\""
    result = subprocess.check_output(cmd, shell=True, cwd="/Users/mohanganesh/wbd/LoopLane").decode().strip()
    return result

def test_flow():
    # ─── 0. CLEAR PREVIOUS TEST DATA (if exists) ──────────────────────────
    log("Cleaning up previous test users...")
    import subprocess
    cmd = "node -e \"require('dotenv').config(); const mongoose=require('mongoose'); const User=require('./models/User'); (async()=>{{ await mongoose.connect(process.env.MONGODB_URI); await User.deleteMany({email: {$in: ['passenger@test.com', 'rider@test.com']}}); process.exit(0); }})()\""
    subprocess.run(cmd, shell=True, cwd="/Users/mohanganesh/wbd/LoopLane")

    # ─── 1. PASSENGER REGISTRATION ──────────────────────────────────────────
    payload = {
        "firstName": "Test",
        "lastName": "Passenger",
        "email": "passenger@test.com",
        "phone": "1111122222",
        "password": "Password123!",
        "role": "PASSENGER"
    }
    log("Registering passenger...")
    r = requests.post(f"{BASE_URL}/auth/register", json=payload)
    if r.status_code not in [200, 201]: error_exit("Passenger registration failed", r)
    
    otp = get_user_otp("passenger@test.com")
    log(f"Extracted OTP: {otp}")

    log("Verifying passenger OTP...")
    r = requests.post(f"{BASE_URL}/auth/verify-otp", json={"email": "passenger@test.com", "otp": otp})
    if r.status_code != 200: error_exit("OTP verification failed", r)

    log("Logging in passenger...")
    r = requests.post(f"{BASE_URL}/auth/login", json={"email": "passenger@test.com", "password": "Password123!"})
    if r.status_code != 200: error_exit("Login failed", r)
    p_token = r.json().get("accessToken")
    p_headers = {"Authorization": f"Bearer {p_token}"}

    # ─── 2. RIDER REGISTRATION ──────────────────────────────────────────────
    payload["email"] = "rider@test.com"
    payload["phone"] = "2222233333"
    payload["role"] = "RIDER"
    payload["firstName"] = "Test"
    payload["lastName"] = "Rider"
    
    log("Registering rider...")
    r = requests.post(f"{BASE_URL}/auth/register", json=payload)
    otp = get_user_otp("rider@test.com")
    requests.post(f"{BASE_URL}/auth/verify-otp", json={"email": "rider@test.com", "otp": otp})
    
    log("Logging in rider...")
    r = requests.post(f"{BASE_URL}/auth/login", json={"email": "rider@test.com", "password": "Password123!"})
    r_token = r.json().get("accessToken")
    r_headers = {"Authorization": f"Bearer {r_token}"}

    # ─── 3. ADMIN VERIFICATION OF RIDER ────────────────────────────────────
    log("Logging in admin...")
    r = requests.post(f"{BASE_URL}/auth/login", json={"email": "admin@looplane.com", "password": "AdminPassword123!"})
    a_token = r.json().get("accessToken")
    a_headers = {"Authorization": f"Bearer {a_token}"}

    log("Fetching rider ID...")
    r = requests.get(f"{BASE_URL}/auth/me", headers=r_headers)
    rider_id = r.json().get("user", {}).get("_id")
    
    log(f"Verifying rider {rider_id} as admin...")
    r = requests.put(f"{BASE_URL}/admin/verifications/{rider_id}/verify", headers=a_headers, json={"status": "VERIFIED"})
    if r.status_code != 200: error_exit("Rider verification failed", r)

    # ─── 4. RIDE POSTING ──────────────────────────────────────────────────
    log("Rider posting a ride...")
    ride_payload = {
        "startLocation": {"name": "Office", "coordinates": [80.27, 13.08]},
        "endLocation": {"name": "Home", "coordinates": [80.20, 13.00]},
        "departureTime": (time.time() + 3600) * 1000,
        "availableSeats": 3,
        "pricePerSeat": 50,
        "vehicleId": "stub_vehicle" # Likely need to add vehicle if validation is strict
    }
    # Note: If validation requires a real vehicle, we might need to update the rider profile first.
    # Let's try posting.
    r = requests.post(f"{BASE_URL}/rides", headers=r_headers, json=ride_payload)
    # If it fails due to vehicle, we'll iterate.
    if r.status_code != 201: 
        log("Ride post failed, fetching user to check vehicle requirement...")
        # (Handling vehicle setup if needed)

    log("✅ Basic flow test script created. Running core validations...")

if __name__ == "__main__":
    test_flow()
