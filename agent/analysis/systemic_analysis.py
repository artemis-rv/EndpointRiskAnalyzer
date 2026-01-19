def analyze_systemic_risk(scan_results, threshold=0.7):
    """
    scan_results: list of endpoint scan JSONs
    threshold: fraction above which an issue is considered systemic
    """

    total_hosts = len(scan_results)
    findings = {}

    def increment(key):
        findings[key] = findings.get(key, 0) + 1

    for scan in scan_results:
        # Firewall
        fw = scan.get("security_controls", {}).get("firewall_status")
        if fw is False:
            increment("firewall_disabled")

        # Antivirus
        av = scan.get("security_controls", {}).get("antivirus_effective_status")
        if av in ["disabled", "unknown"]:
            increment("antivirus_not_confirmed")

        # Privilege
        if scan.get("privilege_posture", {}).get("user_is_admin") is True:
            increment("admin_users")

        if scan.get("privilege_posture", {}).get("uac_enabled") is False:
            increment("uac_disabled")

        # Exposure
        exposure = scan.get("exposure_posture", {})
        if exposure.get("rdp_enabled") is True:
            increment("rdp_enabled")

        if exposure.get("smbv1_enabled") is True:
            increment("smbv1_enabled")

        if exposure.get("risky_listening_ports"):
            increment("risky_ports_exposed")

    systemic_findings = []

    for issue, count in findings.items():
        ratio = count / total_hosts
        if ratio >= threshold:
            systemic_findings.append({
                "issue": issue,
                "affected_percentage": round(ratio * 100, 2),
                "classification": "systemic"
            })

    return {
        "total_hosts": total_hosts,
        "systemic_issues": systemic_findings
    }
