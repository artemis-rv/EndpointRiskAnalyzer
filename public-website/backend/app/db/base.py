"""
app/db/base.py
───────────────
SQLAlchemy 2.x declarative base configuration.
All ORM models must import and extend `Base`.
"""

from __future__ import annotations

from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    """
    Project-wide SQLAlchemy declarative base.

    All models subclass this to participate in Alembic migrations
    and the SQLAlchemy metadata graph.
    """
    pass
