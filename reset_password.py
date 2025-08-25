import sqlite3
import hashlib
import secrets

def reset_password():
    db_path = "app/leadflow.db"
    
    # New password hashing function (from new main.py)
    def hash_password(password: str) -> str:
        salt = secrets.token_hex(16)
        pwd_hash = hashlib.pbkdf2_hmac('sha256', password.encode('utf-8'), salt.encode('utf-8'), 100000)
        return f"{salt}:{pwd_hash.hex()}"
    
    # Reset password for npagano@besenpartners.com
    new_password = "password123"  # You can change this
    new_hash = hash_password(new_password)
    
    try:
        conn = sqlite3.connect(db_path)
        conn.row_factory = sqlite3.Row
        
        # Update password
        cursor = conn.execute(
            "UPDATE agents SET password_hash = ? WHERE email = ?",
            (new_hash, "npagano@besenpartners.com")
        )
        
        if cursor.rowcount > 0:
            conn.commit()
            print(f"✅ Password reset successfully!")
            print(f"Email: npagano@besenpartners.com")
            print(f"New Password: {new_password}")
            print("You can now log in with these credentials.")
        else:
            print("❌ User not found")
        
        conn.close()
        
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    reset_password()