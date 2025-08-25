import sqlite3
import os

# Check the backup database
def check_backup_database():
    # Check both possible backup locations
    backup_paths = ["leadflow-saas.db", "leadflow-pro.db", "app/leadflow-saas.db"]
    
    for db_path in backup_paths:
        print(f"\n=== Checking {db_path} ===")
        if os.path.exists(db_path):
            print(f"Database exists: True")
            print(f"Database size: {os.path.getsize(db_path)} bytes")
            
            try:
                conn = sqlite3.connect(db_path)
                conn.row_factory = sqlite3.Row
                
                # Check agents table
                try:
                    cursor = conn.execute("SELECT COUNT(*) as count FROM agents")
                    agent_count = cursor.fetchone()[0]
                    print(f"Agents in database: {agent_count}")
                    
                    if agent_count > 0:
                        cursor = conn.execute("SELECT email, first_name, last_name FROM agents")
                        agents = cursor.fetchall()
                        print("Existing agents:")
                        for agent in agents:
                            print(f"  - {agent['email']} ({agent['first_name']} {agent['last_name']})")
                except:
                    print("No agents table found")
                
                # Check properties table
                try:
                    cursor = conn.execute("SELECT COUNT(*) as count FROM agent_properties")
                    property_count = cursor.fetchone()[0]
                    print(f"Properties in database: {property_count}")
                    
                    if property_count > 0:
                        cursor = conn.execute("SELECT address, unit, rent FROM agent_properties")
                        properties = cursor.fetchall()
                        print("Existing properties:")
                        for prop in properties:
                            print(f"  - {prop['address']} {prop['unit'] or ''} - ${prop['rent']}")
                except:
                    print("No properties table found")
                
                conn.close()
                
            except Exception as e:
                print(f"Error reading database: {e}")
        else:
            print(f"Database does not exist")

if __name__ == "__main__":
    check_backup_database()