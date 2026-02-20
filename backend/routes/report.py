"""
report.py
---------
API routes for generating organizational reports.
"""

from fastapi import APIRouter
from backend.services.report_service import generate_organization_report
from fastapi.responses import StreamingResponse
from backend.services.pdf_report_service import generate_pdf_from_report


router = APIRouter()


@router.get("/api/report/organization")
def get_organization_report():
    """
    Returns structured Organizational Security Posture Report.
    """
    return generate_organization_report()

@router.get("/api/report/organization/pdf")
def download_organization_report_pdf():
    report_data = generate_organization_report()

    pdf_buffer = generate_pdf_from_report(report_data)

    return StreamingResponse(
        pdf_buffer,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"attachment; filename=organization_posture_report.pdf"
        },
    )
