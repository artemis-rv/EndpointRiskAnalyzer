# PowerShell script to verify WMI antivirus detection
# This can be used to manually verify the productState values

Write-Host "==================================================================" -ForegroundColor Cyan
Write-Host "Windows Security Center - Antivirus Product Detection" -ForegroundColor Cyan
Write-Host "==================================================================" -ForegroundColor Cyan
Write-Host ""

try {
    $avProducts = Get-WmiObject -Namespace "root\SecurityCenter2" -Class AntiVirusProduct
    
    if ($avProducts.Count -eq 0) {
        Write-Host "No antivirus products detected" -ForegroundColor Yellow
    } else {
        Write-Host "Detected $($avProducts.Count) antivirus product(s):" -ForegroundColor Green
        Write-Host ""
        
        foreach ($av in $avProducts) {
            Write-Host "Product Name: $($av.displayName)" -ForegroundColor White
            Write-Host "  Product State (Raw): $($av.productState) (0x$("{0:X}" -f $av.productState))" -ForegroundColor Gray
            
            # Decode the productState bitmask
            $productState = $av.productState
            
            # Check enabled status (bit 12-15)
            $enabled = ($productState -band 0x1000) -ne 0
            Write-Host "  Enabled: $enabled" -ForegroundColor $(if ($enabled) { "Green" } else { "Red" })
            
            # Check definition status (varies by implementation)
            $defsUpdated = ($productState -band 0x10) -ne 0
            Write-Host "  Definitions Updated: $defsUpdated" -ForegroundColor $(if ($defsUpdated) { "Green" } else { "Yellow" })
            
            # Real-time protection (typically same as enabled)
            $realtimeActive = $enabled
            Write-Host "  Real-time Protection: $realtimeActive" -ForegroundColor $(if ($realtimeActive) { "Green" } else { "Red" })
            
            Write-Host ""
        }
    }
    
    Write-Host "==================================================================" -ForegroundColor Cyan
    
} catch {
    Write-Host "Error querying WMI: $_" -ForegroundColor Red
}
