import sqlite3
import os

# Check the databases I can see in your file explorer
def check_all_databases():
    # Check the databases visible in your screenshot
    db_files = [
        "leadflow-pro.db",  # 24 KB file I can see
        "leadflow.saas.db"  # 56 KB file I can see - might be named slightly different
    ]
    
    # Also check for any .db files in current directory
    for file in os.listdir("."):
        if file.endswith(".db"):
            db_files.append(file)
    
    # Remove duplicates
    db_files = list(set(db_files))
    
    print("Looking for database files...")
    print(f"Files in current directory: {[f for f in os.listdir('.') if f.endswith('.db')]}")
    
    for db_path in db_files:
        if os.path.exists(db_path):
            print(f"\n=== Found: {db_path} ===")
            print(f"Size: {os.path.getsize(db_path)} bytes")
            
            try:
                conn = sqlite3.connect(db_path)
                conn.row_factory = sqlite3.Row
                
                # List all tables
                cursor = conn.execute("SELECT name FROM sqlite_master WHERE type='table';")
                tables = [row[0] for row in cursor.fetchall()]
                print(f"Tables: {tables}")
                
                # Check agents if table exists
                if 'agents' in tables:
                    cursor = conn.execute("SELECT COUNT(*) as count FROM agents")
                    agent_count = cursor.fetchone()[0]
                    print(f"Agents: {agent_count}")
                    
                    if agent_count > 0:
                        cursor = conn.execute("SELECT email, first_name, last_name FROM agents LIMIT 5")
                        agents = cursor.fetchall()
                        for agent in agents:
                            print(f"  - {agent['email']} ({agent['first_name']} {agent['last_name']})")
                
                # Check properties if table exists
                if 'agent_properties' in tables:
                    cursor = conn.execute("SELECT COUNT(*) as count FROM agent_properties")
                    property_count = cursor.fetchone()[0]
                    print(f"Properties: {property_count}")
                    
                    if property_count > 0:
                        cursor = conn.execute("SELECT address, unit, rent FROM agent_properties LIMIT 5")
                        properties = cursor.fetchall()
                        for prop in properties:
                            print(f"  - {prop['address']} {prop['unit'] or ''} - ${prop['rent']}")
                
                conn.close()
                
            except Exception as e:
                print(f"Error: {e}")

if __name__ == "__main__":
    check_all_databases()