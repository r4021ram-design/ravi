"""
WebSocket Manager
Handles real-time connections for live tick data updates.
"""

from typing import List, Dict
from fastapi import WebSocket

class ConnectionManager:
    def __init__(self):
        # Store active connections
        self.active_connections: List[WebSocket] = []
        # Store connections by topics (e.g., "NIFTY", "BANKNIFTY")
        self.rooms: Dict[str, List[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, topics: List[str] = None):
        await websocket.accept()
        self.active_connections.append(websocket)
        
        if topics:
            for topic in topics:
                if topic not in self.rooms:
                    self.rooms[topic] = []
                self.rooms[topic].append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
        for topic in self.rooms:
            if websocket in self.rooms[topic]:
                self.rooms[topic].remove(websocket)

    async def broadcast(self, message: dict):
        for connection in self.active_connections:
            await connection.send_json(message)

    async def broadcast_to_topic(self, topic: str, message: dict):
        if topic in self.rooms:
            for connection in self.rooms[topic]:
                await connection.send_json(message)

manager = ConnectionManager()
