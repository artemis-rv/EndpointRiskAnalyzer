"""
SCHEMA AUTHORITY
────────────────
Prisma owns this database schema. Both Prisma migrations are applied and
`alembic_version` does not exist, so this Alembic revision has never run against
the live database.

It is kept as a faithful mirror of the Prisma schema for environments that
provision with Alembic instead. The enum type names below therefore match the
ones Prisma creates exactly — PascalCase, quoted. Two migration tools naming the
same logical type differently is what produced the "type releasestatus does not
exist" failure this revision was corrected for.

If you change the schema, change `prisma/schema.prisma` first.
Initial schema — mirrors Prisma schema.prisma

Revision ID: 0001
Revises: 
Create Date: 2026-06-23

Tables created:
- User
- Release
- Download
- Feedback
- ContactRequest

Enums created:
- userrole
- releasestatus
- feedbacktype
- feedbackstatus
- contactcategory
- contactstatus
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── Enums ─────────────────────────────────────────────────────────────────
    userrole = postgresql.ENUM(
        "USER", "ADMIN", "SUPER_ADMIN", name="UserRole", create_type=True
    )
    userrole.create(op.get_bind(), checkfirst=True)

    releasestatus = postgresql.ENUM(
        "DRAFT", "PUBLISHED", "ARCHIVED", name="ReleaseStatus", create_type=True
    )
    releasestatus.create(op.get_bind(), checkfirst=True)

    feedbacktype = postgresql.ENUM(
        "RATING", "BUG", "FEATURE_REQUEST", "TESTIMONIAL", "GENERAL",
        name="FeedbackType", create_type=True,
    )
    feedbacktype.create(op.get_bind(), checkfirst=True)

    feedbackstatus = postgresql.ENUM(
        "NEW", "UNDER_REVIEW", "ACCEPTED", "REJECTED", "RESOLVED",
        name="FeedbackStatus", create_type=True,
    )
    feedbackstatus.create(op.get_bind(), checkfirst=True)

    contactcategory = postgresql.ENUM(
        "SALES", "SUPPORT", "BUG", "FEATURE_REQUEST", "PARTNERSHIP", "GENERAL",
        name="ContactCategory", create_type=True,
    )
    contactcategory.create(op.get_bind(), checkfirst=True)

    contactstatus = postgresql.ENUM(
        "NEW", "IN_PROGRESS", "RESPONDED", "CLOSED",
        name="ContactStatus", create_type=True,
    )
    contactstatus.create(op.get_bind(), checkfirst=True)

    # ── User ──────────────────────────────────────────────────────────────────
    op.create_table(
        "User",
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("first_name", sa.String(), nullable=False),
        sa.Column("last_name", sa.String(), nullable=False),
        sa.Column("email", sa.String(), nullable=False),
        sa.Column("password_hash", sa.String(), nullable=False),
        sa.Column("country_code", sa.String(10), nullable=False),
        sa.Column("company_name", sa.String(), nullable=True),
        sa.Column(
            "role",
            postgresql.ENUM(
                "USER", "ADMIN", "SUPER_ADMIN", name="UserRole", create_type=False
            ),
            nullable=False,
            server_default="USER",
        ),
        sa.Column(
            "email_verified", sa.Boolean(), nullable=False, server_default="false"
        ),
        sa.Column("email_verified_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column("last_login_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "is_active", sa.Boolean(), nullable=False, server_default="true"
        ),
        sa.PrimaryKeyConstraint("user_id"),
        sa.UniqueConstraint("email"),
    )
    op.create_index("ix_user_email", "User", ["email"], unique=True)

    # ── Release ───────────────────────────────────────────────────────────────
    op.create_table(
        "Release",
        sa.Column("release_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("version", sa.String(), nullable=False),
        sa.Column("title", sa.String(), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("release_notes", sa.Text(), nullable=False),
        sa.Column("file_path", sa.String(), nullable=False),
        sa.Column("file_size", sa.BigInteger(), nullable=False),
        sa.Column("sha256_checksum", sa.String(64), nullable=False),
        sa.Column(
            "published_by_user_id", postgresql.UUID(as_uuid=True), nullable=False
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column("published_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "is_latest", sa.Boolean(), nullable=False, server_default="false"
        ),
        sa.Column(
            "release_status",
            postgresql.ENUM(
                "DRAFT", "PUBLISHED", "ARCHIVED",
                name="ReleaseStatus", create_type=False,
            ),
            nullable=False,
            server_default="DRAFT",
        ),
        sa.ForeignKeyConstraint(
            ["published_by_user_id"], ["User.user_id"], ondelete="RESTRICT"
        ),
        sa.PrimaryKeyConstraint("release_id"),
        sa.UniqueConstraint("version"),
    )
    op.create_index("ix_release_version", "Release", ["version"], unique=True)
    op.create_index(
        "ix_release_published_by", "Release", ["published_by_user_id"]
    )

    # ── Download ──────────────────────────────────────────────────────────────
    op.create_table(
        "Download",
        sa.Column("download_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("release_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "downloaded_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column("ip_address", sa.String(45), nullable=True),
        sa.Column("user_agent", sa.String(512), nullable=True),
        sa.Column("download_source", sa.String(64), nullable=False),
        sa.ForeignKeyConstraint(
            ["user_id"], ["User.user_id"], ondelete="RESTRICT"
        ),
        sa.ForeignKeyConstraint(
            ["release_id"], ["Release.release_id"], ondelete="RESTRICT"
        ),
        sa.PrimaryKeyConstraint("download_id"),
    )
    op.create_index("ix_download_user_id", "Download", ["user_id"])
    op.create_index("ix_download_release_id", "Download", ["release_id"])
    op.create_index("ix_download_downloaded_at", "Download", ["downloaded_at"])

    # ── Feedback ──────────────────────────────────────────────────────────────
    op.create_table(
        "Feedback",
        sa.Column("feedback_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "type",
            postgresql.ENUM(
                "RATING", "BUG", "FEATURE_REQUEST", "TESTIMONIAL", "GENERAL",
                name="FeedbackType", create_type=False,
            ),
            nullable=False,
        ),
        sa.Column("title", sa.String(), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("rating", sa.Integer(), nullable=True),
        sa.Column(
            "status",
            postgresql.ENUM(
                "NEW", "UNDER_REVIEW", "ACCEPTED", "REJECTED", "RESOLVED",
                name="FeedbackStatus", create_type=False,
            ),
            nullable=False,
            server_default="NEW",
        ),
        sa.Column(
            "featured", sa.Boolean(), nullable=False, server_default="false"
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(
            ["user_id"], ["User.user_id"], ondelete="RESTRICT"
        ),
        sa.PrimaryKeyConstraint("feedback_id"),
    )
    op.create_index("ix_feedback_user_id", "Feedback", ["user_id"])
    op.create_index("ix_feedback_status", "Feedback", ["status"])
    op.create_index("ix_feedback_featured", "Feedback", ["featured"])

    # ── ContactRequest ────────────────────────────────────────────────────────
    op.create_table(
        "ContactRequest",
        sa.Column(
            "contact_request_id", postgresql.UUID(as_uuid=True), nullable=False
        ),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("subject", sa.String(), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column(
            "category",
            postgresql.ENUM(
                "SALES", "SUPPORT", "BUG", "FEATURE_REQUEST", "PARTNERSHIP", "GENERAL",
                name="ContactCategory", create_type=False,
            ),
            nullable=False,
        ),
        sa.Column(
            "status",
            postgresql.ENUM(
                "NEW", "IN_PROGRESS", "RESPONDED", "CLOSED",
                name="ContactStatus", create_type=False,
            ),
            nullable=False,
            server_default="NEW",
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column("closed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "handled_by_user_id", postgresql.UUID(as_uuid=True), nullable=True
        ),
        sa.ForeignKeyConstraint(
            ["user_id"], ["User.user_id"], ondelete="RESTRICT"
        ),
        sa.ForeignKeyConstraint(
            ["handled_by_user_id"], ["User.user_id"], ondelete="SET NULL"
        ),
        sa.PrimaryKeyConstraint("contact_request_id"),
    )
    op.create_index(
        "ix_contact_request_user_id", "ContactRequest", ["user_id"]
    )
    op.create_index(
        "ix_contact_request_status", "ContactRequest", ["status"]
    )
    op.create_index(
        "ix_contact_request_handled_by", "ContactRequest", ["handled_by_user_id"]
    )


def downgrade() -> None:
    op.drop_table("ContactRequest")
    op.drop_table("Feedback")
    op.drop_table("Download")
    op.drop_table("Release")
    op.drop_table("User")

    # Drop enums
    for enum_name in [
        "ContactStatus", "ContactCategory", "FeedbackStatus",
        "FeedbackType", "ReleaseStatus", "UserRole",
    ]:
        op.execute(f'DROP TYPE IF EXISTS "{enum_name}"')
