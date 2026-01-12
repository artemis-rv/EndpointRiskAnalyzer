# llm_explainer.py
"""
LLM-based explanation layer.
This module converts risk, anomaly, and feature data into
human-readable, grounded explanations.
"""

def build_prompt(scan):
    """
    Build a strict, grounded prompt for the LLM.
    """

    system = scan.get("system", {})
    risk = scan.get("risk_assessment", {})
    anomaly = scan.get("anomaly_assessment", {})
    flags = scan.get("risk_flags", [])
    features = scan.get("features", {})

    prompt = f"""
You are a senior cybersecurity analyst.

You are given security assessment results for ONE endpoint.
Your task is to EXPLAIN the findings clearly and honestly.

RULES:
- Use ONLY the provided data.
- Do NOT invent vulnerabilities or exploits.
- Do NOT mention CVEs unless explicitly provided (they are not).
- If information is insufficient, say so clearly.
- Justify every statement with the data.

--- SYSTEM CONTEXT ---
Hostname: {system.get("hostname")}
Operating System: {system.get("os")}

--- RISK ASSESSMENT ---
Overall Risk Score: {risk.get("risk_score")}
Risk Level: {risk.get("risk_level")}
Risk Breakdown: {risk.get("breakdown")}

--- ANOMALY ASSESSMENT ---
Is Anomalous: {anomaly.get("is_anomalous")}
Anomaly Score: {anomaly.get("anomaly_score")}

--- RISK FLAGS ---
{flags}

--- FEATURES (SUMMARY) ---
{features}

--- OUTPUT FORMAT ---
Return your response in THREE clearly labeled sections:

1. Executive Summary
   - High-level, non-technical explanation (3–5 lines)

2. Technical Explanation
   - Explain WHY the risk score is what it is
   - Reference specific flags and conditions
   - Mention anomaly status if relevant

3. Recommended Actions
   - Bullet list
   - Ordered by priority
   - Only actions justified by the data

Begin.
"""
    return prompt


def explain_with_llm(scan, llm_client):
    """
    Call the LLM using a provided client.
    The llm_client is expected to expose a `generate(text)` method.
    """

    prompt = build_prompt(scan)

    response = llm_client.generate(prompt)

    return {
        "llm_explanation": response
    }

