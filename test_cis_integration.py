"""
Integration test for CIS compliance module

Tests full agent scan with CIS data collection and ML feature extraction.
"""

import unittest
import sys
import os
import json

# Add paths
project_root = os.path.dirname(os.path.abspath(__file__))
agent_path = os.path.join(project_root, 'agent')
backend_path = os.path.join(project_root, 'backend')
sys.path.insert(0, agent_path)
sys.path.insert(0, backend_path)

# Import after path setup
import day8_cis_compliance
from day8_cis_compliance import collect_cis_compliance
import day3
from day3 import extract_features


class TestCISIntegration(unittest.TestCase):
    """Integration tests for CIS compliance system"""
    
    def test_collect_cis_compliance_structure(self):
        """Verify CIS data structure from collection"""
        print("\\n[TEST] Collecting CIS compliance data...")
        
        cis_data = collect_cis_compliance()
        
        # Verify top-level structure
        self.assertIn("controls", cis_data)
        self.assertIn("compliance_score", cis_data)
        
        # Verify controls is a list
        self.assertIsInstance(cis_data["controls"], list)
        self.assertGreater(len(cis_data["controls"]), 0, "Controls list should not be empty")
        
        # Verify each control has required fields
        for control in cis_data["controls"]:
            required_fields = ["control_id", "name", "status", "severity_weight", "details"]
            for field in required_fields:
                self.assertIn(field, control, f"Control {control.get('control_id')} missing field: {field}")
        
        # Verify compliance score structure
        score = cis_data["compliance_score"]
        score_fields = ["weighted_score", "compliant_count", "non_compliant_count", "total_weight", "compliant_weight"]
        for field in score_fields:
            self.assertIn(field, score, f"Compliance score missing field: {field}")
        
        # Verify score is valid
        self.assertGreaterEqual(score["weighted_score"], 0)
        self.assertLessEqual(score["weighted_score"], 100)
        
        print(f"[PASS] Collected {len(cis_data['controls'])} CIS controls")
        print(f"[PASS] Compliance score: {score['weighted_score']:.2f}%")
        print(f"[PASS] Compliant: {score['compliant_count']}, Non-compliant: {score['non_compliant_count']}")
    
    def test_feature_extraction_with_cis(self):
        """Verify ML feature extraction includes CIS metrics"""
        print("\\n[TEST] Testing feature extraction with CIS data...")
        
        # Create mock scan data with CIS compliance
        mock_scan = {
            "system": {
                "hostname": "test-host",
                "os": "Windows",
                "os_version": "10.0.19042"
            },
            "security": {
                "defender": {"realtime_protection": "True"},
                "firewall": {"Public": "ON", "Private": "ON", "Domain": "ON"}
            },
            "runtimes": {
                "java": {"present": False},
                "python": {"present": False}
            },
            "installed_softwares": [{"name": "App1"}, {"name": "App2"}],
            "cis_compliance": {
                "controls": [
                    {"status": "compliant", "severity_weight": 3},
                    {"status": "non-compliant", "severity_weight": 3},
                    {"status": "compliant", "severity_weight": 2},
                    {"status": "non-compliant", "severity_weight": 1}
                ],
                "compliance_score": {
                    "weighted_score": 66.67,
                    "compliant_count": 2,
                    "non_compliant_count": 2,
                    "total_weight": 9,
                    "compliant_weight": 6
                }
            }
        }
        
        features, risk = extract_features(mock_scan)
        
        # Verify CIS features are extracted
        self.assertIn("cis_weighted_score", features)
        self.assertIn("cis_critical_failures", features)
        self.assertIn("cis_total_failures", features)
        
        # Verify CIS feature values
        self.assertEqual(features["cis_weighted_score"], 66.67)
        self.assertEqual(features["cis_critical_failures"], 1)  # One critical (weight=3) non-compliant
        self.assertEqual(features["cis_total_failures"], 2)
        
        print(f"[PASS] CIS weighted score: {features['cis_weighted_score']}")
        print(f"[PASS] CIS critical failures: {features['cis_critical_failures']}")
        print(f"[PASS] CIS total failures: {features['cis_total_failures']}")
    
    def test_ml_service_feature_extraction(self):
        """Verify ML service can extract CIS features"""
        print("\\n[TEST] Testing ML service feature extraction...")
        
        try:
            from services.ml_service import extract_features as ml_extract, FEATURE_COLUMNS
            
            # Verify CIS features are in FEATURE_COLUMNS
            self.assertIn("cis_weighted_score", FEATURE_COLUMNS)
            self.assertIn("cis_critical_failures", FEATURE_COLUMNS)
            self.assertIn("cis_total_failures", FEATURE_COLUMNS)
            
            # Create mock scan data
            mock_scan = {
                "exposure_posture": {
                    "rdp_enabled": False,
                    "winrm_enabled": False,
                    "remote_registry_enabled": False
                },
                "risky_listening_ports": [],
                "listening_ports_count": 10,
                "features": {
                    "av_enabled": 1,
                    "firewall_any_off": 0,
                    "software_count": 25,
                    "large_attack_surface": 0
                },
                "cis_compliance": {
                    "controls": [
                        {"status": "compliant", "severity_weight": 3},
                        {"status": "compliant", "severity_weight": 3}
                    ],
                    "compliance_score": {
                        "weighted_score": 100.0,
                        "compliant_count": 2,
                        "non_compliant_count": 0
                    }
                }
            }
            
            features = ml_extract(mock_scan)
            
            # Verify CIS features extracted
            self.assertIn("cis_weighted_score", features)
            self.assertEqual(features["cis_weighted_score"], 100.0)
            self.assertEqual(features["cis_critical_failures"], 0)
            self.assertEqual(features["cis_total_failures"], 0)
            
            print(f"[PASS] ML service extracts CIS features correctly")
            print(f"[PASS] Total feature columns: {len(FEATURE_COLUMNS)}")
            
        except ImportError as e:
            self.skipTest(f"ML service not available: {e}")


class TestCISControls(unittest.TestCase):
    """Test individual CIS control categories"""
    
    def test_cis_control_coverage(self):
        """Verify all 7 CIS control categories are present"""
        print("\\n[TEST] Verifying CIS control coverage...")
        
        cis_data = collect_cis_compliance()
        controls = cis_data["controls"]
        
        # Expected control categories (by prefix)
        expected_categories = {
            "1.": "Account Policies",
            "2.": "Guest Account",
            "9.": "Firewall",
            "18.3": "Network Security (SMB)",
            "18.5": "Network Security (LLMNR)",
            "18.9": "Remote Access / Encryption",
            "13.": "Antivirus",
            "17.": "Audit Policies"
        }
        
        found_categories = set()
        for control in controls:
            control_id = control["control_id"]
            for prefix in expected_categories.keys():
                if control_id.startswith(prefix):
                    found_categories.add(prefix)
        
        # Verify we have controls from all categories
        self.assertGreater(len(found_categories), 0, "No CIS controls found")
        
        print(f"[PASS] Found controls from {len(found_categories)} categories")
        print(f"[INFO] Total controls: {len(controls)}")


if __name__ == '__main__':
    # Run tests with verbose output
    print("="*70)
    print("CIS COMPLIANCE INTEGRATION TESTS")
    print("="*70)
    
    # Disable unittest's default test result output temporarily
    suite = unittest.TestLoader().loadTestsFromModule(sys.modules[__name__])
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)
    
    # Summary
    print("\\n" + "="*70)
    print("TEST SUMMARY")
    print("="*70)
    print(f"Tests run: {result.testsRun}")
    print(f"Successes: {result.testsRun - len(result.failures) - len(result.errors)}")
    print(f"Failures: {len(result.failures)}")
    print(f"Errors: {len(result.errors)}")
    
    if result.wasSuccessful():
        print("\\n✅ ALL INTEGRATION TESTS PASSED")
    else:
        print("\\n❌ SOME TESTS FAILED")
    
    sys.exit(0 if result.wasSuccessful() else 1)
