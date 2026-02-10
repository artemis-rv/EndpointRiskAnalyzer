
import sys
import os

sys.path.append(os.getcwd())

try:
    import backend.db.main
    print(f"backend.db.main is loaded from: {backend.db.main.__file__}")
except Exception as e:
    print(f"Error importing backend.db.main: {e}")

try:
    import backend
    print(f"backend package is loaded from: {backend.__file__}")
except Exception as e:
    print(f"Error importing backend: {e}")
