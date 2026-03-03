"""
pdf_report_service.py
---------------------
Generates formatted PDF for Organizational Security Posture Report.
Uses reportlab.platypus for structured formatting.
"""

from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.platypus import ListFlowable, ListItem
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.lib.pagesizes import A4
from reportlab.lib import fonts
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfbase import pdfmetrics

from io import BytesIO
from datetime import datetime


def generate_pdf_from_report(report_data: dict):
    """
    Converts structured report JSON into formatted PDF.
    Returns PDF as byte stream.
    """

    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4)
    elements = []

    styles = getSampleStyleSheet()

    # Title
    elements.append(Paragraph("<b>IntelliPosture Organizational Security Posture Report</b>", styles["Title"]))
    elements.append(Spacer(1, 0.3 * inch))

    metadata = report_data.get("metadata", {})
    report = report_data.get("report", {})

    # Metadata section
    elements.append(Paragraph(f"Report Version: {metadata.get('report_version')}", styles["Normal"]))
    elements.append(Paragraph(f"Generated At: {metadata.get('generated_at')}", styles["Normal"]))
    elements.append(Spacer(1, 0.2 * inch))

    # Executive Summary
    elements.append(Paragraph("<b>Executive Summary</b>", styles["Heading2"]))
    elements.append(Spacer(1, 0.1 * inch))

    exec_summary = report.get("executive_summary", {})

    summary_lines = [
        f"Overall Compliance Score: {exec_summary.get('overall_compliance_score')}%",
        f"Compliance Band: {exec_summary.get('compliance_band')}",
        f"Total Endpoints: {exec_summary.get('total_endpoints')}",
        f"Critical Failures: {exec_summary.get('total_critical_failures')}",
        f"High Failures: {exec_summary.get('total_high_failures')}",
        f"Moderate Failures: {exec_summary.get('total_moderate_failures')}",
        f"Latest Scan Time: {exec_summary.get('latest_scan_at')}",
    ]

    for line in summary_lines:
        elements.append(Paragraph(line, styles["Normal"]))
        elements.append(Spacer(1, 0.1 * inch))

    elements.append(Spacer(1, 0.3 * inch))

    # Priority Actions
    elements.append(Paragraph("<b>Top Priority Actions</b>", styles["Heading2"]))
    elements.append(Spacer(1, 0.1 * inch))

    priorities = report.get("priority_actions", [])

    priority_list = [ListItem(Paragraph(item, styles["Normal"])) for item in priorities]
    elements.append(ListFlowable(priority_list, bulletType="bullet"))

    elements.append(Spacer(1, 0.3 * inch))

    # Endpoint Table
    elements.append(Paragraph("<b>Endpoint Compliance Overview (Latest Scan Per Endpoint)</b>", styles["Heading2"]))
    elements.append(Spacer(1, 0.1 * inch))

    endpoint_table = report.get("endpoint_table", [])

    table_data = [["Hostname", "OS", "Compliance %", "Risk", "Critical", "High", "Moderate", "Scan Time"]]

    for ep in endpoint_table:
        table_data.append([
            ep.get("hostname"),
            ep.get("os"),
            ep.get("compliance_score"),
            ep.get("deviation_level"),
            ep.get("critical_failures"),
            ep.get("high_failures"),
            ep.get("moderate_failures"),
            ep.get("scan_time"),
        ])

    table = Table(table_data, repeatRows=1)
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.grey),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.whitesmoke),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
        ("ALIGN", (1, 1), (-1, -1), "CENTER"),
    ]))

    elements.append(table)

    doc.build(elements)
    buffer.seek(0)

    return buffer
