import sqlite3
import hashlib
import secrets

def test_login():
    db_path = "app/leadflow.db"
    
    def verify_password(password: str, password_hash: str) -> bool:
        try:
            salt, pwd_hash = password_hash.split(':')
            return pwd_hash == hashlib.pbkdf2_hmac('sha256', password.encode('utf-8'), salt.encode('utf-8'), 100000).hex()
        except:
            return False
    
    try:
        conn = sqlite3.connect(db_path)
        conn.row_factory = sqlite3.Row
        
        # Get the user
        cursor = conn.execute("SELECT * FROM agents WHERE email = ?", ("npagano@besenpartners.com",))
        agent = cursor.fetchone()
        
        if agent:
            print(f"✅ Found user: {agent['email']}")
            print(f"Active: {agent.get('is_active', 'Unknown')}")
            
            # Test the password
            test_password = "password123"
            if verify_password(test_password, agent['password_hash']):
                print(f"✅ Password verification SUCCESS")
            else:
                print(f"❌ Password verification FAILED")
                
                # Reset it again with a completely new hash
                def hash_password(password: str) -> str:
                    salt = secrets.token_hex(16)
                    pwd_hash = hashlib.pbkdf2_hmac('sha256', password.encode('utf-8'), salt.encode('utf-8'), 100000)
                    return f"{salt}:{pwd_hash.hex()}"
                
                new_hash = hash_password("test123")
                cursor = conn.execute("UPDATE agents SET password_hash = ? WHERE email = ?", (new_hash, "npagano@besenpartners.com"))
                conn.commit()
                print(f"✅ Password reset to: test123")
                
        else:
            print("❌ User not found")
        
        conn.close()
        
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    test_login()