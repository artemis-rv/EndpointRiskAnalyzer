from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List
from datetime import datetime, timezone
from bson import ObjectId


class PyObjectId(ObjectId):
    @classmethod
    def __get_validators__(cls):
        yield cls.validate

    @classmethod
    def validate(cls, v):
        # Accept already-constructed ObjectId instances
        if isinstance(v, ObjectId):
            return v

        # Accept strings that are valid ObjectId hex values
        if isinstance(v, str) and ObjectId.is_valid(v):
            return ObjectId(v)

        raise ValueError("Invalid ObjectId")



#Organisation schema
class Organization(BaseModel):
    id: PyObjectId = Field(default_factory=PyObjectId, alias="_id")
    name: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Config:
        allow_population_by_field_name = True
        arbitrary_types_allowed = True
        json_encoders = {ObjectId: str}


#Endpoint schema
class Endpoint(BaseModel):
    id: PyObjectId = Field(default_factory=PyObjectId, alias="_id")
    organization_id: PyObjectId

    hostname: str
    os: str

    last_seen: datetime = Field(default_factory=datetime.now(timezone.utc))

    class Config:
        allow_population_by_field_name = True
        arbitrary_types_allowed = True
        json_encoders = {ObjectId: str}


#Endpoint scan schema
class EndpointScan(BaseModel):
    id: PyObjectId = Field(default_factory=PyObjectId, alias="_id")
    endpoint_id: PyObjectId

    scan_time: datetime = Field(default_factory=datetime.now(timezone.utc))
    scan_data: Dict[str, Any]   # full agent JSON

    class Config:
        allow_population_by_field_name = True
        arbitrary_types_allowed = True
        json_encoders = {ObjectId: str}


#
class OrgPostureSnapshot(BaseModel):
    id: PyObjectId = Field(default_factory=PyObjectId, alias="_id")
    organization_id: PyObjectId

    generated_at: datetime = Field(default_factory=datetime.now(timezone.utc))
    posture_data: Dict[str, Any]  # org_posture.json

    class Config:
        allow_population_by_field_name = True
        arbitrary_types_allowed = True
        json_encoders = {ObjectId: str}


#
class OrgInterpretation(BaseModel):
    id: PyObjectId = Field(default_factory=PyObjectId, alias="_id")
    posture_snapshot_id: PyObjectId

    generated_at: datetime = Field(default_factory=datetime.now(timezone.utc))
    interpretation: Dict[str, Any]  # org_interpretation.json

    class Config:
        allow_population_by_field_name = True
        arbitrary_types_allowed = True
        json_encoders = {ObjectId: str}


#
class User(BaseModel):
    id: PyObjectId = Field(default_factory=PyObjectId, alias="_id")
    email: str
    role: str = "viewer"

    class Config:
        allow_population_by_field_name = True
        arbitrary_types_allowed = True
        json_encoders = {ObjectId: str}
