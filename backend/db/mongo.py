"""
mongo.py

MongoDB connection module.

Responsibilities:
- Create MongoDB client
- Expose database handle
- Centralize connection logic

This module deliberately avoids:
- Business logic
- Schema validation
- Application state

It is imported by backend routes and services.
"""

import os
from pymongo import MongoClient
from pymongo.errors import ConnectionFailure


# -------------------------------
# Configuration
# -------------------------------

# MongoDB connection string
# Example: mongodb://localhost:27017
MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")

# Database name for this project
DB_NAME = os.getenv("DB_NAME", "org_security_posture_dev")  #dev is only for testing
#change when deploying


# -------------------------------
# Client Initialization
# -------------------------------

def get_mongo_client() -> MongoClient:
    """
    Creates and returns a MongoDB client.

    Raises:
        ConnectionFailure: if MongoDB is unreachable
    """
    try:
        client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=5000)
        # Force connection check
        client.admin.command("ping")
        return client
    except ConnectionFailure as e:
        raise RuntimeError(f"MongoDB connection failed: {e}")


# Create a single client instance (module-level)
mongo_client = get_mongo_client()

# Database handle
db = mongo_client[DB_NAME]


# -------------------------------
# Collection Access Helpers
# -------------------------------

def organizations_collection():
    return db["organizations"]


def endpoints_collection():
    return db["endpoints"]


def endpoint_scans_collection():
    return db["endpoint_scans"]


def org_posture_snapshots_collection():
    return db["org_posture_snapshots"]


def org_interpretations_collection():
    return db["org_interpretations"]

def agent_jobs_collection():
    return db["agent_jobs"]

