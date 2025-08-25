import sqlite3
import os

# Check what happened to the database
def check_database():
    db_path = "app/leadflow.db"
    
    print(f"Checking database at: {db_path}")
    print(f"Database exists: {os.path.exists(db_path)}")
    
    if os.path.exists(db_path):
        print(f"Database size: {os.path.getsize(db_path)} bytes")
        
        try:
            conn = sqlite3.connect(db_path)
            conn.row_factory = sqlite3.Row
            
            # Check agents table
            cursor = conn.execute("SELECT COUNT(*) as count FROM agents")
            agent_count = cursor.fetchone()[0]
            print(f"Agents in database: {agent_count}")
            
            if agent_count > 0:
                cursor = conn.execute("SELECT email, first_name, last_name FROM agents")
                agents = cursor.fetchall()
                print("Existing agents:")
                for agent in agents:
                    print(f"  - {agent['email']} ({agent['first_name']} {agent['last_name']})")
            
            # Check properties table
            cursor = conn.execute("SELECT COUNT(*) as count FROM agent_properties")
            property_count = cursor.fetchone()[0]
            print(f"Properties in database: {property_count}")
            
            if property_count > 0:
                cursor = conn.execute("SELECT address, unit, rent FROM agent_properties")
                properties = cursor.fetchall()
                print("Existing properties:")
                for prop in properties:
                    print(f"  - {prop['address']} {prop['unit'] or ''} - ${prop['rent']}")
            
            conn.close()
            
        except Exception as e:
            print(f"Error reading database: {e}")
    else:
        print("Database file does not exist!")

if __name__ == "__main__":
    check_database()