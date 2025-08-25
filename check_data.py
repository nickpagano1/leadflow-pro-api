import sqlite3

def check_data():
    conn = sqlite3.connect("app/leadflow.db")
    conn.row_factory = sqlite3.Row
    
    # Check agents
    cursor = conn.execute("SELECT id, email FROM agents")
    agents = cursor.fetchall()
    print("AGENTS:")
    for agent in agents:
        print(f"  ID: {agent['id']}, Email: {agent['email']}")
    
    # Check properties
    cursor = conn.execute("SELECT * FROM agent_properties")
    properties = cursor.fetchall()
    print(f"\nPROPERTIES ({len(properties)}):")
    for prop in properties:
        print(f"  ID: {prop['id']}, Agent: {prop['agent_id']}, Address: {prop['address']}")
        print(f"     Rent: ${prop['rent']}, Active: {prop['is_active']}")
    
    conn.close()

if __name__ == "__main__":
    check_data()