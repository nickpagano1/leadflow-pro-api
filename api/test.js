module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache');
  
  const html = `<!DOCTYPE html>
<html>
<head>
    <title>🚀 LeadFlow Pro - Working Signup</title>
    <meta charset="utf-8">
    <style>
        body { 
            font-family: Arial, sans-serif; 
            max-width: 500px; 
            margin: 50px auto; 
            padding: 20px;
            background: #f5f5f5;
        }
        .container {
            background: white;
            padding: 30px;
            border-radius: 10px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        }
        h1 { color: #333; text-align: center; }
        .form-group { margin-bottom: 15px; }
        label { display: block; margin-bottom: 5px; font-weight: bold; }
        input { 
            width: 100%; 
            padding: 10px; 
            border: 1px solid #ddd; 
            border-radius: 4px; 
            box-sizing: border-box;
        }
        button { 
            width: 100%; 
            padding: 12px; 
            background: #007cba; 
            color: white; 
            border: none; 
            border-radius: 4px; 
            cursor: pointer;
            font-size: 16px;
        }
        button:hover { background: #005a87; }
        button:disabled { background: #ccc; cursor: not-allowed; }
        .result { 
            margin-top: 20px; 
            padding: 15px; 
            border-radius: 4px; 
            white-space: pre-wrap;
            font-family: monospace;
        }
        .success { background: #d4edda; color: #155724; border: 1px solid #c3e6cb; }
        .error { background: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; }
        .status { 
            text-align: center; 
            padding: 10px; 
            background: #e3f2fd; 
            border-radius: 4px; 
            margin-bottom: 20px;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🚀 LeadFlow Pro Signup</h1>
        <div class="status">✅ Simple Test Interface (No Dependencies)</div>
        
        <form id="signupForm">
            <div class="form-group">
                <label>Email:</label>
                <input type="email" id="email" value="test\${Date.now()}@example.com" required>
            </div>
            <div class="form-group">
                <label>First Name:</label>
                <input type="text" id="firstName" value="John" required>
            </div>
            <div class="form-group">
                <label>Last Name:</label>
                <input type="text" id="lastName" value="Doe" required>
            </div>
            <div class="form-group">
                <label>Company:</label>
                <input type="text" id="company" value="LeadFlow Pro">
            </div>
            <div class="form-group">
                <label>Password:</label>
                <input type="password" id="password" value="TestPass123!" required>
            </div>
            <button type="submit" id="submitBtn">Create Account</button>
        </form>
        
        <div id="result"></div>
    </div>

    <script>
        // Set unique email
        document.getElementById('email').value = 'test' + Date.now() + '@example.com';
        
        document.getElementById('signupForm').addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const submitBtn = document.getElementById('submitBtn');
            const result = document.getElementById('result');
            
            submitBtn.disabled = true;
            submitBtn.textContent = 'Creating Account...';
            result.innerHTML = '';
            
            const data = {
                email: document.getElementById('email').value,
                first_name: document.getElementById('firstName').value,
                last_name: document.getElementById('lastName').value,
                company: document.getElementById('company').value,
                password: document.getElementById('password').value
            };
            
            console.log('Sending data:', { ...data, password: '[HIDDEN]' });
            
            try {
                const response = await fetch('/api/auth/signup', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });
                
                console.log('Response:', response.status);
                const responseData = await response.json();
                console.log('Data:', responseData);
                
                if (response.ok && responseData.success) {
                    result.className = 'result success';
                    result.innerHTML = \`🎉 SUCCESS!

Account Created Successfully!
✅ User: \${responseData.user?.firstName} \${responseData.user?.lastName}
✅ Email: \${responseData.user?.email}  
✅ ID: \${responseData.user?.id}
✅ Token: Generated

Ready to use LeadFlow Pro!\`;
                    
                    if (responseData.access_token) {
                        localStorage.setItem('access_token', responseData.access_token);
                    }
                } else {
                    result.className = 'result error';
                    result.innerHTML = \`❌ ERROR: \${responseData.error}

\${JSON.stringify(responseData, null, 2)}\`;
                }
            } catch (error) {
                result.className = 'result error';
                result.innerHTML = \`💥 NETWORK ERROR: \${error.message}\`;
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Create Account';
            }
        });
    </script>
</body>
</html>`;
  
  res.status(200).send(html);
};