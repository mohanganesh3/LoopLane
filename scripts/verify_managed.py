import subprocess
import time
import requests
import os
import signal

BASE_URL = "http://localhost:3099/api"
LOG_FILE = "/tmp/verify_python.log"

def log(msg):
    entry = f"[*] {msg}"
    print(entry)
    with open(LOG_FILE, "a") as f:
        f.write(entry + "\n")

def run_test():
    if os.path.exists(LOG_FILE): os.remove(LOG_FILE)
    log("--- STARTING PYTHON-MANAGED VERIFICATION ---")

    # Start server
    env = os.environ.copy()
    env["PORT"] = "3099"
    server_proc = subprocess.Popen(
        ["node", "server.js"],
        cwd="/Users/mohanganesh/wbd/LoopLane",
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True
    )
    log(f"Server PID: {server_proc.pid}")

    try:
        # Wait for server
        log("Waiting for server to be ready...")
        ready = False
        for i in range(15):
            try:
                resp = requests.get(f"{BASE_URL}/health", timeout=2)
                if resp.status_code == 200:
                    log("Server is READY")
                    ready = True
                    break
            except:
                time.sleep(2)
        
        if not ready:
            log("Server failed to start in time")
            return

        # 1. REGISTER
        log("Phase 1: Registration")
        payload = {
            "name": "Test User",
            "email": "pytest@test.com",
            "phone": "1000000000",
            "password": "Password123!",
            "confirmPassword": "Password123!",
            "role": "PASSENGER"
        }
        resp = requests.post(f"{BASE_URL}/auth/register", json=payload)
        log(f"Register status: {resp.status_code}")
        if resp.status_code != 201:
            log(f"Register failed: {resp.text}")
            return

        log("--- PHASE 1 SUCCESS ---")
        # I'll stop here to verify this first basic step works.

    except Exception as e:
        log(f"Error during test: {str(e)}")
    finally:
        log("Shutting down server...")
        server_proc.send_signal(signal.SIGTERM)
        server_proc.wait()
        log("Done")

if __name__ == "__main__":
    run_test()
