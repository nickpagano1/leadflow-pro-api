import sqlite3

def fix_status_column():
    db_path = "app/leadflow.db"
    conn = sqlite3.connect(db_path)
    
    try:
        # Check if status column exists
        cursor = conn.execute("PRAGMA table_info(agent_properties)")
        columns = [row[1] for row in cursor.fetchall()]
        print(f"Current columns: {columns}")
        
        if 'status' not in columns:
            print("Adding status column...")
            conn.execute("ALTER TABLE agent_properties ADD COLUMN status TEXT DEFAULT 'active'")
            
            # Update existing properties to have 'active' status
            conn.execute("UPDATE agent_properties SET status = 'active' WHERE status IS NULL")
            
            conn.commit()
            print("✅ Status column added successfully!")
        else:
            print("Status column already exists")
        
        # Verify the fix
        cursor = conn.execute("SELECT id, address, status, is_active FROM agent_properties")
        properties = cursor.fetchall()
        print(f"\nProperties after fix:")
        for prop in properties:
            print(f"  ID: {prop[0]}, Address: {prop[1]}, Status: {prop[2]}, Active: {prop[3]}")
            
    except Exception as e:
        print(f"Error: {e}")
    finally:
        conn.close()

if __name__ == "__main__":
    fix_status_column()