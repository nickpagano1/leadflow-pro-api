import sqlite3

def fix_database():
    db_path = "app/leadflow.db"
    
    try:
        conn = sqlite3.connect(db_path)
        
        # Check what columns exist
        cursor = conn.execute("PRAGMA table_info(agent_properties)")
        columns = [row[1] for row in cursor.fetchall()]
        print(f"Current columns: {columns}")
        
        # Add missing columns with NULL default first
        if 'updated_at' not in columns:
            print("Adding updated_at column...")
            conn.execute("ALTER TABLE agent_properties ADD COLUMN updated_at DATETIME")
            # Then update all existing rows
            conn.execute("UPDATE agent_properties SET updated_at = datetime('now') WHERE updated_at IS NULL")
        
        conn.commit()
        
        # Verify the fix
        cursor = conn.execute("SELECT id, address, unit, rent, created_at, updated_at FROM agent_properties")
        properties = cursor.fetchall()
        print(f"\nProperties after fix: {len(properties)}")
        for prop in properties:
            print(f"- ID: {prop[0]}, {prop[1]} {prop[2] or ''} - ${prop[3]}")
            print(f"  Created: {prop[4]}, Updated: {prop[5]}")
        
        conn.close()
        print("\n✅ Database fixed successfully!")
        
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    fix_database()