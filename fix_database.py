import sqlite3

def fix_database():
    db_path = "app/leadflow.db"
    
    try:
        conn = sqlite3.connect(db_path)
        
        # Check what columns exist
        cursor = conn.execute("PRAGMA table_info(agent_properties)")
        columns = [row[1] for row in cursor.fetchall()]
        print(f"Current columns: {columns}")
        
        # Add missing columns if they don't exist
        if 'updated_at' not in columns:
            print("Adding updated_at column...")
            conn.execute("ALTER TABLE agent_properties ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP")
        
        if 'created_at' not in columns:
            print("Adding created_at column...")
            conn.execute("ALTER TABLE agent_properties ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP")
        
        # Update existing rows to have timestamps
        conn.execute("UPDATE agent_properties SET created_at = CURRENT_TIMESTAMP WHERE created_at IS NULL")
        conn.execute("UPDATE agent_properties SET updated_at = CURRENT_TIMESTAMP WHERE updated_at IS NULL")
        
        conn.commit()
        
        # Verify the fix
        cursor = conn.execute("SELECT * FROM agent_properties")
        properties = cursor.fetchall()
        print(f"\nProperties after fix: {len(properties)}")
        for prop in properties:
            print(f"- {prop[1]} {prop[2] or ''} - ${prop[3]}")  # address, unit, rent
        
        conn.close()
        print("\n✅ Database fixed successfully!")
        
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    fix_database()