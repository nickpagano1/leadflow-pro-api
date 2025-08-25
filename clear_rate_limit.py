import sqlite3

def clear_rate_limit():
    # The rate limiting is stored in memory, so restarting the server will clear it
    # But let's also make sure there are no database locks
    
    print("Rate limiting will be cleared when you restart the server.")
    print("Also, let's verify your account is ready:")
    
    try:
        conn = sqlite3.connect("app/leadflow.db")
        conn.row_factory = sqlite3.Row
        
        cursor = conn.execute("SELECT email, first_name, last_name FROM agents WHERE email = ?", ("npagano@besenpartners.com",))
        agent = cursor.fetchone()
        
        if agent:
            print(f"✅ Account ready: {agent['email']} ({agent['first_name']} {agent['last_name']})")
        else:
            print("❌ Account not found")
        
        conn.close()
        
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    clear_rate_limit()