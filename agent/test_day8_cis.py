"""
Unit tests for day8_cis_compliance module

Tests CIS compliance scoring, control checks, and security measures.
"""

import unittest
import sys
import os

# Add agent directory to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__)))

from day8_cis_compliance import (
    calculate_weighted_score,
    check_firewall_compliance,
    check_smbv1_disabled,
    check_rdp_compliance,
    _safe_registry_read
)


class TestWeightedScoring(unittest.TestCase):
    """Test weighted compliance score calculation"""
    
    def test_all_compliant(self):
        """Test score when all controls are compliant"""
        controls = [
            {"status": "compliant", "severity_weight": 3},
            {"status": "compliant", "severity_weight": 2},
            {"status": "compliant", "severity_weight": 1}
        ]
        result = calculate_weighted_score(controls)
        
        self.assertEqual(result["weighted_score"], 100.0)
        self.assertEqual(result["compliant_count"], 3)
        self.assertEqual(result["non_compliant_count"], 0)
        self.assertEqual(result["total_weight"], 6)
        self.assertEqual(result["compliant_weight"], 6)
    
    def test_partial_compliance(self):
        """Test score with some non-compliant controls"""
        controls = [
            {"status": "compliant", "severity_weight": 3},
            {"status": "compliant", "severity_weight": 2},
            {"status": "non-compliant", "severity_weight": 1}
        ]
        result = calculate_weighted_score(controls)
        
        # Total weight: 6, compliant weight: 5
        expected_score = (5 / 6) * 100
        self.assertAlmostEqual(result["weighted_score"], expected_score, places=2)
        self.assertEqual(result["compliant_count"], 2)
        self.assertEqual(result["non_compliant_count"], 1)
    
    def test_no_compliant_controls(self):
        """Test score when no controls are compliant"""
        controls = [
            {"status": "non-compliant", "severity_weight": 3},
            {"status": "non-compliant", "severity_weight": 2}
        ]
        result = calculate_weighted_score(controls)
        
        self.assertEqual(result["weighted_score"], 0.0)
        self.assertEqual(result["compliant_count"], 0)
        self.assertEqual(result["non_compliant_count"], 2)
    
    def test_empty_controls(self):
        """Test score with empty controls list"""
        controls = []
        result = calculate_weighted_score(controls)
        
        self.assertEqual(result["weighted_score"], 0.0)
        self.assertEqual(result["total_weight"], 0)


class TestFirewallCompliance(unittest.TestCase):
    """Test firewall compliance checks"""
    
    def test_all_profiles_enabled(self):
        """Test when all firewall profiles are enabled"""
        firewall_data = {
            "Domain": "ON",
            "Private": "ON",
            "Public": "ON"
        }
        result = check_firewall_compliance(firewall_data)
        
        self.assertEqual(result["status"], "compliant")
        self.assertEqual(result["severity_weight"], 3)
        self.assertIn("Domain: ON", result["details"])
    
    def test_public_profile_disabled(self):
        """Test when public profile is disabled"""
        firewall_data = {
            "Domain": "ON",
            "Private": "ON",
            "Public": "OFF"
        }
        result = check_firewall_compliance(firewall_data)
        
        self.assertEqual(result["status"], "non-compliant")
        self.assertIn("Public: OFF", result["details"])
    
    def test_all_profiles_disabled(self):
        """Test when all profiles are disabled"""
        firewall_data = {
            "Domain": "OFF",
            "Private": "OFF",
            "Public": "OFF"
        }
        result = check_firewall_compliance(firewall_data)
        
        self.assertEqual(result["status"], "non-compliant")


class TestSMBv1Compliance(unittest.TestCase):
    """Test SMBv1 compliance checks"""
    
    def test_smbv1_disabled(self):
        """Test when SMBv1 is disabled (compliant)"""
        result = check_smbv1_disabled(False)
        
        self.assertEqual(result["status"], "compliant")
        self.assertEqual(result["severity_weight"], 3)
        self.assertIn("Disabled", result["details"])
    
    def test_smbv1_enabled(self):
        """Test when SMBv1 is enabled (non-compliant)"""
        result = check_smbv1_disabled(True)
        
        self.assertEqual(result["status"], "non-compliant")
        self.assertIn("Enabled", result["details"])
    
    def test_smbv1_unknown(self):
        """Test when SMBv1 status is unknown"""
        result = check_smbv1_disabled(None)
        
        self.assertEqual(result["status"], "non-compliant")
        self.assertIn("Unknown", result["details"])


class TestRDPCompliance(unittest.TestCase):
    """Test RDP compliance checks"""
    
    def test_rdp_disabled(self):
        """Test when RDP is disabled (compliant)"""
        result = check_rdp_compliance(False)
        
        self.assertEqual(result["status"], "compliant")
        self.assertEqual(result["severity_weight"], 2)
        self.assertIn("Disabled", result["details"])
    
    def test_rdp_enabled(self):
        """Test when RDP is enabled (non-compliant)"""
        result = check_rdp_compliance(True)
        
        self.assertEqual(result["status"], "non-compliant")
        self.assertIn("Enabled", result["details"])
    
    def test_rdp_unknown(self):
        """Test when RDP status is unknown"""
        result = check_rdp_compliance(None)
        
        self.assertEqual(result["status"], "non-compliant")


class TestSecurityMeasures(unittest.TestCase):
    """Test security measures like registry path validation"""
    
    def test_registry_path_allowlist(self):
        """Test that only allowed registry paths can be accessed"""
        # This should return None for paths not in allowlist
        result = _safe_registry_read(
            r"INVALID\PATH\NOT\IN\ALLOWLIST",
            "SomeKey"
        )
        self.assertIsNone(result)
    
    def test_allowed_registry_path(self):
        """Test that allowed paths are processed"""
        # Note: This may still return None if the key doesn't exist,
        # but it won't fail due to path validation
        result = _safe_registry_read(
            r"SYSTEM\CurrentControlSet\Control\Lsa",
            "NonExistentKey"
        )
        # Should return None (key doesn't exist) but not raise exception
        self.assertIsNone(result)


class TestControlStructure(unittest.TestCase):
    """Test that control results have proper structure"""
    
    def test_control_has_required_fields(self):
        """Verify control output contains all required fields"""
        result = check_rdp_compliance(False)
        
        required_fields = ["control_id", "name", "status", "severity_weight", "details"]
        for field in required_fields:
            self.assertIn(field, result, f"Missing required field: {field}")
    
    def test_status_values(self):
        """Verify status is either 'compliant' or 'non-compliant'"""
        result = check_rdp_compliance(False)
        self.assertIn(result["status"], ["compliant", "non-compliant"])
    
    def test_severity_weight_range(self):
        """Verify severity weight is between 1-3"""
        result = check_rdp_compliance(False)
        self.assertIn(result["severity_weight"], [1, 2, 3])


if __name__ == '__main__':
    # Run tests with verbose output
    unittest.main(verbosity=2)
