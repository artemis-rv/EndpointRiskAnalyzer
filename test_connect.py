
import requests
import sys

try:
    url = f"http://127.0.0.1:8002/api/ml/train"
    print(f"Testing {url}")
    # Use POST for training
    r = requests.post(url, timeout=10)
    print(f"Status: {r.status_code}")
    print(f"Text: {r.text}")
    
    # Also test prediction if train works
    # Using a dummy ID or list
    # r2 = requests.get("http://127.0.0.1:8002/api/ml/predict/test", timeout=5)
    # print(f"Predict Status: {r2.status_code}")
except Exception as e:
    print(f"Error: {e}")
