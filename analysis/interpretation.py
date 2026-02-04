"""
interpretation.py

This module converts organization-level posture findings
into human-readable interpretations.

It consumes:
- org_posture.json (output of systemic_analysis.py)

It produces:
- org_interpretation.json (plain-language summary)

IMPORTANT:
- No new analysis is performed here.
- No security judgments are made.
- This is a descriptive layer only.
"""

import json
import os

from interpretation_rules import ISSUE_INTERPRETATIONS


# -------------------------------
# Helper functions
# -------------------------------

def load_org_posture(file_path: str) -> dict:
    """
    Loads the organization-level posture JSON file.
    """
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"org_posture.json not found at {file_path}")

    with open(file_path, "r", encoding="utf-8") as f:
        return json.load(f)


def interpret_issue(issue_entry: dict) -> str:
    """
    Generates a human-readable interpretation for a single issue.

    Each issue_entry contains:
    - issue
    - classification (systemic / isolated)
    """
    issue_name = issue_entry.get("issue")
    classification = issue_entry.get("classification")

    # If we do not have a predefined rule, return a neutral statement
    if issue_name not in ISSUE_INTERPRETATIONS:
        return f"The configuration '{issue_name}' was observed with classification '{classification}'."

    rule_set = ISSUE_INTERPRETATIONS[issue_name]

    if classification not in rule_set:
        return f"The configuration '{issue_name}' has an unrecognized classification."

    # Apply the corresponding interpretation rule
    return rule_set[classification]()


# -------------------------------
# Core interpretation logic
# -------------------------------

def generate_interpretation(org_posture: dict) -> dict:
    """
    Converts organization posture data into an interpretation summary.
    """

    summary = org_posture.get("summary", {})
    systemic_issues = org_posture.get("systemic_issues", [])
    isolated_issues = org_posture.get("isolated_issues", [])

    observations = []

    # Interpret systemic issues first (they define norms)
    for issue in systemic_issues:
        observations.append(interpret_issue(issue))

    # Interpret isolated issues second
    for issue in isolated_issues:
        observations.append(interpret_issue(issue))

    return {
        "organization_overview": {
            "total_hosts_analyzed": summary.get("total_hosts_analyzed"),
            "analysis_scope": "Passive organizational posture normalization"
        },
        "key_observations": observations,
        "context_notes": [
            "These observations describe configuration patterns and do not represent security risk assessments.",
            "No real-time monitoring, exploitability analysis, or remediation is performed.",
            "Findings are based on passive endpoint evidence and may be influenced by visibility limitations."
        ]
    }


# -------------------------------
# Main execution
# -------------------------------

def main():
    project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    org_posture_path = os.path.join(project_root, "org_posture.json")
    output_path = os.path.join(project_root, "org_interpretation.json")

    print("[INFO] Loading organization posture...")
    org_posture = load_org_posture(org_posture_path)

    print("[INFO] Generating interpretation...")
    interpretation = generate_interpretation(org_posture)

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(interpretation, f, indent=2)

    print(f"[SUCCESS] Interpretation saved to {output_path}")


if __name__ == "__main__":
    main()
