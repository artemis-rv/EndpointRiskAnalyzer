
from fastapi import APIRouter, HTTPException
from backend.services.ml_service import train_models, predict_risk
from backend.db.mongo import endpoint_scans_collection, endpoints_collection
from bson import ObjectId

router = APIRouter(prefix="/api/ml", tags=["ML"])

@router.post("/train")
def trigger_training():
    """
    Triggers model retraining.
    """
    try:
        result = train_models()
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/predict/{endpoint_id}")
def get_endpoint_risk(endpoint_id: str):
    """
    Get risk analysis for the LATEST scan of a specific endpoint.
    """
    # 1. Get endpoint's latest scan
    # Assuming scans are stored in endpoint_scans_collection with endpoint_id
    # We need to find the most recent one.
    
    # endpoint_id might be a UUID string or ObjectId string depending on legacy data.
    # Ideally search by both or standardize.
    
    # Try finding latest scan by scan_time desc
    scan = endpoint_scans_collection().find_one(
        {"endpoint_id": endpoint_id},
        sort=[("scan_time", -1)]
    )
    
    if not scan:
         # Try with ObjectId if needed, but let's assume string ID for now as per schema
         # If no scan, cannot predict
         return {"risk": "Unknown", "details": "No scans found for this endpoint"}
         
    # 2. Predict
    try:
        analysis = predict_risk(scan.get("scan_data", {}))
        return analysis
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
