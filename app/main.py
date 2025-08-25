# Complete LeadFlow Pro main.py with bulletproof authentication and Wone.co style endpoints
import sqlite3
import hashlib
import secrets
import jwt
import logging
import time
import re
from datetime import datetime, timedelta
import json
from typing import Optional

from fastapi import FastAPI, HTTPException, Depends, Request, Form, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.templating import Jinja2Templates
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr, validator
from contextlib import contextmanager

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(
    title="LeadFlow Pro",
    description="Enterprise Real Estate Inquiry Automation Platform",
    version="1.0.0"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Security configuration
SECRET_KEY = "your-secret-key-change-this-in-production"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 1440  # 24 hours

# Security scheme
security = HTTPBearer()

# Database configuration
DATABASE_PATH = "app/leadflow.db"

# Rate limiting storage
rate_limit_storage = {}

# Pydantic models
class AgentCreate(BaseModel):
    email: EmailStr
    first_name: str
    last_name: str
    company: str
    password: str

    @validator('first_name', 'last_name')
    def validate_names(cls, v):
        if not v or len(v.strip()) < 2:
            raise ValueError('Name must be at least 2 characters long')
        if not re.match(r'^[a-zA-Z\s-]+$', v.strip()):
            raise ValueError('Name contains invalid characters')
        return v.strip().title()

    @validator('company')
    def validate_company(cls, v):
        if not v or len(v.strip()) < 2:
            raise ValueError('Company name must be at least 2 characters long')
        return v.strip()

    @validator('password')
    def validate_password(cls, v):
        if len(v) < 8:
            raise ValueError('Password must be at least 8 characters long')
        if not re.search(r'[A-Za-z]', v):
            raise ValueError('Password must contain at least one letter')
        if not re.search(r'\d', v):
            raise ValueError('Password must contain at least one number')
        return v

class AgentLogin(BaseModel):
    email: EmailStr
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str
    agent: dict

# Initialize automation tracking tables
def init_automation_tracking_tables():
    """Initialize automation tracking tables"""
    conn = sqlite3.connect(DATABASE_PATH)
    
    # Email automation tracking table
    conn.execute("""
        CREATE TABLE IF NOT EXISTS email_automation_tracking (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            property_id INTEGER,
            prospect_email TEXT,
            email_sent_date DATETIME DEFAULT CURRENT_TIMESTAMP,
            acuity_appointment_id INTEGER,
            tour_scheduled BOOLEAN DEFAULT FALSE,
            tour_date DATETIME,
            appointment_type_id TEXT,
            prospect_name TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (property_id) REFERENCES agent_properties (id)
        )
    """)
    
    # Automation stats table for dashboard
    conn.execute("""
        CREATE TABLE IF NOT EXISTS automation_stats (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            agent_id INTEGER,
            emails_sent INTEGER DEFAULT 0,
            tours_scheduled INTEGER DEFAULT 0,
            response_rate REAL DEFAULT 0.0,
            last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (agent_id) REFERENCES agents (id)
        )
    """)
    
    conn.commit()
    conn.close()

def update_automation_stats(agent_id: int, conn=None):
    """Update automation statistics for an agent"""
    close_conn = False
    if conn is None:
        conn = sqlite3.connect(DATABASE_PATH)
        close_conn = True
    
    try:
        # Count emails sent (placeholder for now - we'll implement email logging later)
        cursor = conn.execute(
            "SELECT COUNT(*) FROM email_automation_tracking WHERE property_id IN (SELECT id FROM agent_properties WHERE agent_id = ?)",
            (agent_id,)
        )
        emails_sent = cursor.fetchone()[0] or 0
        
        # Count tours scheduled
        cursor = conn.execute(
            "SELECT COUNT(*) FROM email_automation_tracking WHERE tour_scheduled = TRUE AND property_id IN (SELECT id FROM agent_properties WHERE agent_id = ?)",
            (agent_id,)
        )
        tours_scheduled = cursor.fetchone()[0] or 0
        
        # Calculate response rate
        response_rate = (tours_scheduled / emails_sent * 100) if emails_sent > 0 else 0.0
        
        # Update or insert stats
        cursor = conn.execute("SELECT id FROM automation_stats WHERE agent_id = ?", (agent_id,))
        existing = cursor.fetchone()
        
        if existing:
            conn.execute("""
                UPDATE automation_stats 
                SET emails_sent = ?, tours_scheduled = ?, response_rate = ?, last_updated = CURRENT_TIMESTAMP
                WHERE agent_id = ?
            """, (emails_sent, tours_scheduled, response_rate, agent_id))
        else:
            conn.execute("""
                INSERT INTO automation_stats (agent_id, emails_sent, tours_scheduled, response_rate)
                VALUES (?, ?, ?, ?)
            """, (agent_id, emails_sent, tours_scheduled, response_rate))
        
        if close_conn:
            conn.commit()
            
    finally:
        if close_conn:
            conn.close()

def get_active_properties_count(agent_id: int) -> int:
    """Get count of active properties for an agent"""
    conn = sqlite3.connect(DATABASE_PATH)
    cursor = conn.execute(
        "SELECT COUNT(*) FROM agent_properties WHERE agent_id = ? AND is_active = TRUE",
        (agent_id,)
    )
    count = cursor.fetchone()[0] or 0
    conn.close()
    return count

def initialize_automation_system():
    """Initialize automation tracking system"""
    init_automation_tracking_tables()
    logger.info("Automation tracking system initialized")

# Database initialization
def init_database():
    """Initialize the database with all required tables"""
    try:
        conn = sqlite3.connect(DATABASE_PATH)
        
        # Agents table
        conn.execute("""
            CREATE TABLE IF NOT EXISTS agents (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT UNIQUE NOT NULL,
                first_name TEXT NOT NULL,
                last_name TEXT NOT NULL,
                company TEXT NOT NULL,
                password_hash TEXT NOT NULL,
                is_active BOOLEAN DEFAULT TRUE,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        # Agent properties table
        conn.execute("""
            CREATE TABLE IF NOT EXISTS agent_properties (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                agent_id INTEGER NOT NULL,
                address TEXT NOT NULL,
                unit TEXT,
                rent REAL,
                bedrooms INTEGER,
                bathrooms REAL,
                square_feet INTEGER,
                description TEXT,
                amenities TEXT,
                availability_date TEXT,
                is_active BOOLEAN DEFAULT TRUE,
                status TEXT DEFAULT 'active',
                acuity_id TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (agent_id) REFERENCES agents (id)
            )
        """)
        
        # Agent inquiries table
        conn.execute("""
            CREATE TABLE IF NOT EXISTS agent_inquiries (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                agent_id INTEGER NOT NULL,
                property_id INTEGER,
                prospect_name TEXT,
                prospect_email TEXT,
                prospect_phone TEXT,
                message TEXT,
                source TEXT,
                status TEXT DEFAULT 'new',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (agent_id) REFERENCES agents (id),
                FOREIGN KEY (property_id) REFERENCES agent_properties (id)
            )
        """)
        
        # Initialize automation tracking tables
        init_automation_tracking_tables()
        
        conn.commit()
        conn.close()
        
        logger.info("Database initialized successfully")
        
    except Exception as e:
        logger.error(f"Database initialization error: {str(e)}")
        raise

# Authentication functions
def hash_password(password: str) -> str:
    """Hash a password with salt"""
    salt = secrets.token_hex(16)
    pwd_hash = hashlib.pbkdf2_hmac('sha256', password.encode('utf-8'), salt.encode('utf-8'), 100000)
    return f"{salt}:{pwd_hash.hex()}"

def verify_password(password: str, password_hash: str) -> bool:
    """Verify a password against its hash"""
    try:
        salt, pwd_hash = password_hash.split(':')
        return pwd_hash == hashlib.pbkdf2_hmac('sha256', password.encode('utf-8'), salt.encode('utf-8'), 100000).hex()
    except:
        return False

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    """Create a JWT access token"""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Verify JWT token"""
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        agent_id: int = payload.get("sub")
        if agent_id is None:
            raise HTTPException(status_code=401, detail="Invalid authentication credentials")
        return agent_id
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid authentication credentials")

def get_current_agent_id(credentials: HTTPAuthorizationCredentials = Depends(security)) -> int:
    """Get current authenticated agent ID"""
    return verify_token(credentials)

def rate_limit_check(identifier: str, max_requests: int = 5, window_minutes: int = 15) -> bool:
    """Check if request should be rate limited"""
    current_time = time.time()
    window_start = current_time - (window_minutes * 60)
    
    if identifier not in rate_limit_storage:
        rate_limit_storage[identifier] = []
    
    # Remove old requests outside the window
    rate_limit_storage[identifier] = [
        req_time for req_time in rate_limit_storage[identifier] 
        if req_time > window_start
    ]
    
    # Check if limit exceeded
    if len(rate_limit_storage[identifier]) >= max_requests:
        return False
    
    # Add current request
    rate_limit_storage[identifier].append(current_time)
    return True

# Templates
templates = Jinja2Templates(directory="app/templates")

# Startup event
@app.on_event("startup")
async def startup():
    """Initialize the application"""
    init_database()
    initialize_automation_system()
    logger.info("LeadFlow Pro started successfully")

# Static files
app.mount("/static", StaticFiles(directory="app/static"), name="static")

# Authentication routes
@app.post("/api/auth/register", response_model=TokenResponse)
async def register_agent(agent: AgentCreate, request: Request):
    """Register a new agent"""
    client_ip = request.client.host
    
    # Rate limiting
    if not rate_limit_check(f"register_{client_ip}", max_requests=3, window_minutes=60):
        raise HTTPException(status_code=429, detail="Too many registration attempts")
    
    try:
        conn = sqlite3.connect(DATABASE_PATH)
        conn.row_factory = sqlite3.Row
        
        # Check if agent already exists
        cursor = conn.execute("SELECT id FROM agents WHERE email = ?", (agent.email,))
        if cursor.fetchone():
            raise HTTPException(status_code=400, detail="Email already registered")
        
        # Hash password
        password_hash = hash_password(agent.password)
        
        # Insert new agent
        cursor = conn.execute("""
            INSERT INTO agents (email, first_name, last_name, company, password_hash)
            VALUES (?, ?, ?, ?, ?)
        """, (agent.email, agent.first_name, agent.last_name, agent.company, password_hash))
        
        agent_id = cursor.lastrowid
        conn.commit()
        
        # Get the created agent
        cursor = conn.execute("SELECT * FROM agents WHERE id = ?", (agent_id,))
        agent_data = cursor.fetchone()
        conn.close()
        
        # Create access token
        access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        access_token = create_access_token(
            data={"sub": str(agent_id)}, expires_delta=access_token_expires
        )
        
        logger.info(f"Agent registered: {agent.email}")
        
        return TokenResponse(
            access_token=access_token,
            token_type="bearer",
            agent={
                "id": agent_data["id"],
                "email": agent_data["email"],
                "first_name": agent_data["first_name"],
                "last_name": agent_data["last_name"],
                "company": agent_data["company"]
            }
        )
        
    except sqlite3.IntegrityError:
        raise HTTPException(status_code=400, detail="Email already registered")
    except Exception as e:
        logger.error(f"Registration error: {str(e)}")
        raise HTTPException(status_code=500, detail="Registration failed")

@app.post("/api/auth/login", response_model=TokenResponse)
async def login_agent(agent: AgentLogin, request: Request):
    """Login an agent"""
    client_ip = request.client.host
    
    # Rate limiting
    if not rate_limit_check(f"login_{client_ip}", max_requests=5, window_minutes=15):
        raise HTTPException(status_code=429, detail="Too many login attempts")
    
    try:
        conn = sqlite3.connect(DATABASE_PATH)
        conn.row_factory = sqlite3.Row
        
        # Get agent by email
        cursor = conn.execute("SELECT * FROM agents WHERE email = ? AND is_active = TRUE", (agent.email,))
        agent_data = cursor.fetchone()
        
        if not agent_data or not verify_password(agent.password, agent_data["password_hash"]):
            raise HTTPException(status_code=401, detail="Invalid email or password")
        
        conn.close()
        
        # Create access token
        access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        access_token = create_access_token(
            data={"sub": str(agent_data["id"])}, expires_delta=access_token_expires
        )
        
        logger.info(f"Agent logged in: {agent.email}")
        
        return TokenResponse(
            access_token=access_token,
            token_type="bearer",
            agent={
                "id": agent_data["id"],
                "email": agent_data["email"],
                "first_name": agent_data["first_name"],
                "last_name": agent_data["last_name"],
                "company": agent_data["company"]
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Login error: {str(e)}")
        raise HTTPException(status_code=500, detail="Login failed")

# Properties API endpoints
@app.get("/api/properties")
async def get_properties(agent_id: int = Depends(get_current_agent_id)):
    """Get all properties for the current agent"""
    try:
        conn = sqlite3.connect(DATABASE_PATH)
        conn.row_factory = sqlite3.Row
        
        cursor = conn.execute("""
            SELECT id, address, unit, rent, bedrooms, bathrooms, 
                   availability_date, status, acuity_id, created_at, updated_at, is_active
            FROM agent_properties 
            WHERE agent_id = ?
            ORDER BY created_at DESC
        """, (agent_id,))
        
        properties = []
        for row in cursor.fetchall():
            property_dict = {
                "id": row["id"],
                "address": row["address"],
                "unit": row["unit"],
                "rent": float(row["rent"]) if row["rent"] else 0.0,
                "bedrooms": row["bedrooms"],
                "bathrooms": row["bathrooms"],
                "availability_date": row["availability_date"],
                "status": row["status"] or "active",
                "acuity_id": row["acuity_id"],
                "is_active": bool(row["is_active"]),
                "created_at": row["created_at"],
                "updated_at": row["updated_at"]
            }
            properties.append(property_dict)
        
        conn.close()
        
        return {
            "success": True,
            "properties": properties,
            "total": len(properties)
        }
        
    except Exception as e:
        logger.error(f"Error fetching properties: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch properties: {str(e)}")

@app.post("/api/properties")
async def create_property(property_data: dict, agent_id: int = Depends(get_current_agent_id)):
    """Create a new property"""
    try:
        conn = sqlite3.connect(DATABASE_PATH)
        
        cursor = conn.execute("""
            INSERT INTO agent_properties 
            (agent_id, address, unit, rent, bedrooms, bathrooms, square_feet, description, amenities, availability_date, acuity_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            agent_id,
            property_data.get("address"),
            property_data.get("unit"),
            property_data.get("rent"),
            property_data.get("bedrooms"),
            property_data.get("bathrooms"),
            property_data.get("square_feet"),
            property_data.get("description"),
            property_data.get("amenities"),
            property_data.get("availability_date"),
            property_data.get("acuity_id")
        ))
        
        property_id = cursor.lastrowid
        conn.commit()
        conn.close()
        
        logger.info(f"Property created by agent {agent_id}: {property_data.get('address')}")
        
        return {
            "success": True,
            "message": "Property created successfully",
            "property_id": property_id
        }
        
    except Exception as e:
        logger.error(f"Error creating property: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to create property: {str(e)}")

@app.put("/api/properties/{property_id}")
async def update_property(property_id: int, property_data: dict, agent_id: int = Depends(get_current_agent_id)):
    """Update a property"""
    try:
        conn = sqlite3.connect(DATABASE_PATH)
        
        # Verify the property belongs to the current agent
        cursor = conn.execute(
            "SELECT id FROM agent_properties WHERE id = ? AND agent_id = ?",
            (property_id, agent_id)
        )
        
        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail="Property not found")
        
        # Update the property
        cursor = conn.execute("""
            UPDATE agent_properties 
            SET address = ?, unit = ?, rent = ?, bedrooms = ?, bathrooms = ?, 
                square_feet = ?, description = ?, amenities = ?, availability_date = ?, 
                acuity_id = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ? AND agent_id = ?
        """, (
            property_data.get("address"),
            property_data.get("unit"),
            property_data.get("rent"),
            property_data.get("bedrooms"),
            property_data.get("bathrooms"),
            property_data.get("square_feet"),
            property_data.get("description"),
            property_data.get("amenities"),
            property_data.get("availability_date"),
            property_data.get("acuity_id"),
            property_id,
            agent_id
        ))
        
        conn.commit()
        conn.close()
        
        return {
            "success": True,
            "message": "Property updated successfully"
        }
        
    except Exception as e:
        logger.error(f"Error updating property: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to update property: {str(e)}")

@app.patch("/api/properties/{property_id}/status")
async def update_property_status(property_id: int, status_data: dict, agent_id: int = Depends(get_current_agent_id)):
    """Update property status"""
    try:
        conn = sqlite3.connect(DATABASE_PATH)
        
        # Verify the property belongs to the current agent
        cursor = conn.execute(
            "SELECT id FROM agent_properties WHERE id = ? AND agent_id = ?",
            (property_id, agent_id)
        )
        
        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail="Property not found")
        
        # Update the property status
        status = status_data.get("status", "active")
        is_active = status_data.get("is_active", status == "active")
        
        cursor = conn.execute("""
            UPDATE agent_properties 
            SET status = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ? AND agent_id = ?
        """, (status, is_active, property_id, agent_id))
        
        conn.commit()
        conn.close()
        
        return {
            "success": True,
            "message": "Property status updated successfully"
        }
        
    except Exception as e:
        logger.error(f"Error updating property status: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to update property status: {str(e)}")

@app.delete("/api/properties/{property_id}")
async def delete_property(property_id: int, agent_id: int = Depends(get_current_agent_id)):
    """Delete a property"""
    try:
        conn = sqlite3.connect(DATABASE_PATH)
        
        # Verify the property belongs to the current agent
        cursor = conn.execute(
            "SELECT id FROM agent_properties WHERE id = ? AND agent_id = ?",
            (property_id, agent_id)
        )
        
        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail="Property not found")
        
        # Delete the property
        cursor = conn.execute(
            "DELETE FROM agent_properties WHERE id = ? AND agent_id = ?",
            (property_id, agent_id)
        )
        
        conn.commit()
        conn.close()
        
        return {
            "success": True,
            "message": "Property deleted successfully"
        }
        
    except Exception as e:
        logger.error(f"Error deleting property: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to delete property: {str(e)}")

# Dashboard API endpoints
@app.get("/api/dashboard/stats")
async def get_dashboard_stats(agent_id: int = Depends(get_current_agent_id)):
    """Get dashboard statistics"""
    try:
        conn = sqlite3.connect(DATABASE_PATH)
        conn.row_factory = sqlite3.Row
        
        # Get total properties
        cursor = conn.execute("SELECT COUNT(*) as count FROM agent_properties WHERE agent_id = ?", (agent_id,))
        total_properties = cursor.fetchone()["count"]
        
        # Get active properties
        cursor = conn.execute("SELECT COUNT(*) as count FROM agent_properties WHERE agent_id = ? AND is_active = TRUE", (agent_id,))
        active_properties = cursor.fetchone()["count"]
        
        # Get total inquiries
        cursor = conn.execute("SELECT COUNT(*) as count FROM agent_inquiries WHERE agent_id = ?", (agent_id,))
        total_inquiries = cursor.fetchone()["count"]
        
        conn.close()
        
        return {
            "success": True,
            "stats": {
                "total_properties": total_properties,
                "active_properties": active_properties,
                "total_inquiries": total_inquiries,
                "response_rate": 0  # Placeholder
            }
        }
        
    except Exception as e:
        logger.error(f"Error fetching dashboard stats: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to fetch dashboard stats")

# Inquiries API endpoints
@app.get("/api/inquiries")
async def get_inquiries(agent_id: int = Depends(get_current_agent_id)):
    """Get inquiries for the current agent"""
    try:
        conn = sqlite3.connect(DATABASE_PATH)
        conn.row_factory = sqlite3.Row
        
        cursor = conn.execute("""
            SELECT i.*, p.address, p.unit 
            FROM agent_inquiries i
            LEFT JOIN agent_properties p ON i.property_id = p.id
            WHERE i.agent_id = ?
            ORDER BY i.created_at DESC
        """, (agent_id,))
        
        inquiries = []
        for row in cursor.fetchall():
            inquiry = {
                "id": row["id"],
                "prospect_name": row["prospect_name"],
                "prospect_email": row["prospect_email"],
                "prospect_phone": row["prospect_phone"],
                "message": row["message"],
                "source": row["source"],
                "status": row["status"],
                "created_at": row["created_at"],
                "property_address": row["address"],
                "property_unit": row["unit"]
            }
            inquiries.append(inquiry)
        
        conn.close()
        
        return {
            "success": True,
            "inquiries": inquiries
        }
        
    except Exception as e:
        logger.error(f"Error fetching inquiries: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to fetch inquiries")

# Acuity webhook endpoint
@app.post("/api/webhooks/acuity")
async def acuity_webhook(request: Request):
    """Handle Acuity Scheduling webhooks for tour bookings"""
    try:
        # Get the webhook payload
        body = await request.body()
        webhook_data = json.loads(body.decode('utf-8'))
        
        logger.info(f"Acuity webhook received: {webhook_data}")
        
        # Extract appointment details
        appointment_id = webhook_data.get('id')
        appointment_type_id = webhook_data.get('appointmentTypeID')
        client_email = webhook_data.get('email')
        client_name = f"{webhook_data.get('firstName', '')} {webhook_data.get('lastName', '')}".strip()
        appointment_datetime = webhook_data.get('datetime')
        
        if not appointment_type_id:
            logger.warning("No appointmentTypeID in webhook data")
            return {"status": "error", "message": "No appointment type ID"}
        
        # Find the property with this Acuity ID
        conn = sqlite3.connect(DATABASE_PATH)
        conn.row_factory = sqlite3.Row
        
        cursor = conn.execute(
            "SELECT id, address, unit, agent_id FROM agent_properties WHERE acuity_id = ?",
            (str(appointment_type_id),)
        )
        property_data = cursor.fetchone()
        
        if not property_data:
            logger.warning(f"No property found with Acuity ID: {appointment_type_id}")
            conn.close()
            return {"status": "error", "message": "Property not found"}
        
        # Log the tour booking
        cursor = conn.execute("""
            INSERT INTO email_automation_tracking 
            (property_id, prospect_email, prospect_name, acuity_appointment_id, 
             tour_scheduled, tour_date, appointment_type_id)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (
            property_data['id'],
            client_email,
            client_name,
            appointment_id,
            True,
            appointment_datetime,
            appointment_type_id
        ))
        
        # Update automation stats
        update_automation_stats(property_data['agent_id'], conn)
        
        conn.commit()
        conn.close()
        
        logger.info(f"Tour scheduled: {client_name} for {property_data['address']}")
        
        return {"status": "success", "message": "Tour booking logged"}
        
    except Exception as e:
        logger.error(f"Acuity webhook error: {str(e)}")
        return {"status": "error", "message": str(e)}

# Automation stats API endpoint
@app.get("/api/automation/stats")
async def get_automation_stats(agent_id: int = Depends(get_current_agent_id)):
    """Get automation statistics for the current agent"""
    try:
        conn = sqlite3.connect(DATABASE_PATH)
        conn.row_factory = sqlite3.Row
        
        cursor = conn.execute(
            "SELECT * FROM automation_stats WHERE agent_id = ?",
            (agent_id,)
        )
        stats = cursor.fetchone()
        
        if not stats:
            # Initialize stats if they don't exist
            update_automation_stats(agent_id, conn)
            conn.commit()
            
            cursor = conn.execute(
                "SELECT * FROM automation_stats WHERE agent_id = ?",
                (agent_id,)
            )
            stats = cursor.fetchone()
        
        conn.close()
        
        return {
            "success": True,
            "stats": {
                "emails_sent": stats['emails_sent'] if stats else 0,
                "tours_scheduled": stats['tours_scheduled'] if stats else 0,
                "response_rate": round(stats['response_rate'], 1) if stats else 0.0,
                "active_properties": get_active_properties_count(agent_id)
            }
        }
        
    except Exception as e:
        logger.error(f"Error fetching automation stats: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# Email logging endpoint
@app.post("/api/automation/log-email")
async def log_email_sent(
    email_data: dict,
    agent_id: int = Depends(get_current_agent_id)
):
    """Log when an automated email is sent"""
    try:
        conn = sqlite3.connect(DATABASE_PATH)
        
        cursor = conn.execute("""
            INSERT INTO email_automation_tracking 
            (property_id, prospect_email, prospect_name, email_sent_date)
            VALUES (?, ?, ?, CURRENT_TIMESTAMP)
        """, (
            email_data.get('property_id'),
            email_data.get('prospect_email'),
            email_data.get('prospect_name', '')
        ))
        
        # Update stats
        update_automation_stats(agent_id, conn)
        
        conn.commit()
        conn.close()
        
        return {"success": True, "message": "Email logged"}
        
    except Exception as e:
        logger.error(f"Error logging email: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# HTML page routes
@app.get("/", response_class=HTMLResponse)
async def root():
    """Root redirect to login"""
    return """
    <html>
        <head><meta http-equiv="refresh" content="0; url=/login"></head>
        <body>Redirecting to login...</body>
    </html>
    """

@app.get("/login", response_class=HTMLResponse)
async def login_page():
    """Login page"""
    return templates.TemplateResponse("login.html", {"request": {}})

@app.get("/signup", response_class=HTMLResponse)
async def signup_page():
    """Signup page"""
    return templates.TemplateResponse("signup.html", {"request": {}})

@app.get("/dashboard", response_class=HTMLResponse)
async def dashboard_page():
    """Dashboard page"""
    return templates.TemplateResponse("dashboard.html", {"request": {}})

@app.get("/properties", response_class=HTMLResponse)
async def properties_page():
    """Properties page"""
    return templates.TemplateResponse("properties.html", {"request": {}})

@app.get("/inquiries", response_class=HTMLResponse)
async def inquiries_page():
    """Inquiries page"""
    return templates.TemplateResponse("inquiries.html", {"request": {}})

@app.get("/automation", response_class=HTMLResponse)
async def automation_page():
    """Automation page"""
    return templates.TemplateResponse("automation.html", {"request": {}})

@app.get("/profile", response_class=HTMLResponse)
async def profile_page():
    """Profile & Settings page"""
    return templates.TemplateResponse("profile.html", {"request": {}})

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)