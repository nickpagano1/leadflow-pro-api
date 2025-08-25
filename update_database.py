import sqlite3

def update_database():
    db_path = "app/leadflow.db"
    conn = sqlite3.connect(db_path)
    
    print("Updating database with automation tracking tables...")
    
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
    print("✅ Created email_automation_tracking table")
    
    # Automation stats table
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
    print("✅ Created automation_stats table")
    
    conn.commit()
    conn.close()
    print("✅ Database updated successfully!")

if __name__ == "__main__":
    update_database()