from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from typing import List, Dict
import logging
from backend.db.mongo import endpoints_collection
import json

router = APIRouter(tags=["WebSockets"])
logger = logging.getLogger(__name__)

class ConnectionManager:
    def __init__(self):
        # Store active connections. Could map endpoint_id -> WebSocket
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket, token: str):
        await websocket.accept()
        
        # Authenticate token
        # For the dashboard UI, we allow a specific token or logic. 
        # In a real app this would be a user session token.
        if token == "dashboard-client":
            self.active_connections.append(websocket)
            logger.info("Dashboard UI client connected")
            return True
            
        endpoint = endpoints_collection().find_one({"api_key": token})
        
        if not endpoint:
            await websocket.send_json({"type": "error", "message": "Authentication failed"})
            await websocket.close(code=1008)
            return False
            
        self.active_connections.append(websocket)
        logger.info(f"Dashboard client connected: {endpoint.get('endpoint_id')}")
        return True

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        # Convert message to json if not already
        if isinstance(message, dict):
            msg_str = json.dumps(message)
        else:
            msg_str = str(message)

        disconnected = []
        for connection in self.active_connections:
            try:
                await connection.send_text(msg_str)
            except RuntimeError:
                # Connection already closed
                disconnected.append(connection)
            except Exception as e:
                logger.error(f"Failed to send message to websocket: {e}")
                disconnected.append(connection)
                
        for conn in disconnected:
            self.disconnect(conn)

manager = ConnectionManager()

@router.websocket("/wss/dashboard")
async def websocket_dashboard(websocket: WebSocket, token: str = Query(...)):
    """
    Secure WebSocket endpoint for real-time dashboard updates.
    Requires valid API token in query parameter ?token=...
    """
    is_authenticated = await manager.connect(websocket, token)
    if not is_authenticated:
        return
        
    try:
        while True:
            # We don't expect much data from the client, just keep connection open
            data = await websocket.receive_text()
            # Can handle incoming messages here if necessary
    except WebSocketDisconnect:
        manager.disconnect(websocket)
        logger.info("Dashboard client disconnected")
