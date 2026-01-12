# llm_client_dummy.py

class DummyLLMClient:
    def generate(self, prompt):
        return (
            "Executive Summary:\n"
            "This endpoint shows elevated risk based on current security posture.\n\n"
            "Technical Explanation:\n"
            "Risk is driven by detected security control weaknesses.\n\n"
            "Recommended Actions:\n"
            "- Review endpoint security configuration\n"
            "- Address identified risk flags\n"
        )
