module.exports = async (req, res) => {
  try {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    const html = `<!DOCTYPE html>
<html>
<head>
    <title>LeadFlow Pro - Working Signup Test</title>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }
        .container {
            background: white;
            border-radius: 10px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.2);
            padding: 40px;
            width: 100%;
            max-width: 500px;
        }
        h1 { 
            text-align: center; 
            margin-bottom: 30px; 
            color: #333;
            font-size: 28px;
        }
        .form-group { 
            margin-bottom: 20px; 
        }
        label { 
            display: block; 
            margin-bottom: 8px; 
            font-weight: 600;
            color: #555;
        }
        input { 
            width: 100%; 
            padding: 12px; 
            border: 2px solid #e1e1e1; 
            border-radius: 6px; 
            font-size: 16px;
            transition: border-color 0.3s ease;
        }
        input:focus {
            outline: none;
            border-color: #667eea;
        }
        button { 
            width: 100%; 
            padding: 14px; 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white; 
            border: none; 
            border-radius: 6px; 
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            transition: transform 0.2s ease;
        }
        button:hover { 
            transform: translateY(-2px);
        }
        button:disabled {
            opacity: 0.6;
            cursor: not-allowed;
            transform: none;
        }
        .result { 
            margin-top: 25px; 
            padding: 15px; 
            border-radius: 6px; 
            white-space: pre-wrap;
            font-family: 'Courier New', monospace;
            font-size: 14px;
        }
        .success { 
            background: #d4edda; 
            color: #155724; 
            border: 2px solid #c3e6cb; 
        }
        .error { 
            background: #f8d7da; 
            color: #721c24; 
            border: 2px solid #f5c6cb; 
        }
        .status {
            text-align: center;
            margin-bottom: 20px;
            padding: 10px;
            background: #e3f2fd;
            border: 1px solid #bbdefb;
            border-radius: 6px;
            font-weight: 500;
        }
        .debug {
            margin-top: 10px;
            font-size: 12px;
            color: #666;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🚀 LeadFlow Pro Signup</h1>
        <div class="status">✅ Direct API Connection - No Dependencies</div>
        
        <form id="signupForm">
            <div class="form-group">
                <label for="email">Email Address:</label>
                <input type="email" id="email" value="test\${Date.now()}@example.com" required>
            </div>
            
            <div class="form-group">
                <label for="firstName">First Name:</label>
                <input type="text" id="firstName" value="John" required>
            </div>
            
            <div class="form-group">
                <label for="lastName">Last Name:</label>
                <input type="text" id="lastName" value="Doe" required>
            </div>
            
            <div class="form-group">
                <label for="company">Company:</label>
                <input type="text" id="company" value="LeadFlow Pro">
            </div>
            
            <div class="form-group">
                <label for="password">Password:</label>
                <input type="password" id="password" value="Password123!" required>
            </div>
            
            <button type="submit" id="submitBtn">Create Account</button>
        </form>
        
        <div id="result"></div>
        <div class="debug" id="debug"></div>
    </div>

    <script>
        console.log('🎯 LeadFlow Pro Signup Test Loaded Successfully!');
        
        // Update email with timestamp to ensure uniqueness
        document.getElementById('email').value = 'test' + Date.now() + '@example.com';
        
        document.getElementById('signupForm').addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const submitBtn = document.getElementById('submitBtn');
            const result = document.getElementById('result');
            const debug = document.getElementById('debug');
            
            // Reset UI
            submitBtn.disabled = true;
            submitBtn.textContent = '⏳ Creating Account...';
            result.innerHTML = '';
            debug.innerHTML = '';
            
            // Collect form data
            const formData = {
                email: document.getElementById('email').value.trim(),
                first_name: document.getElementById('firstName').value.trim(),
                last_name: document.getElementById('lastName').value.trim(),
                company: document.getElementById('company').value.trim(),
                password: document.getElementById('password').value
            };
            
            console.log('📤 Sending signup data:', { ...formData, password: '[HIDDEN]' });
            debug.innerHTML = '📡 Sending request to /api/auth/signup...';
            
            try {
                const response = await fetch('/api/auth/signup', {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    },
                    body: JSON.stringify(formData)
                });
                
                console.log('📡 Response Status:', response.status);
                console.log('📡 Response Headers:', Object.fromEntries(response.headers.entries()));
                
                const responseData = await response.json();
                console.log('📦 Response Data:', responseData);
                
                if (response.ok && responseData.success) {
                    result.className = 'result success';
                    result.innerHTML = \`🎉 SUCCESS! Account Created!

✅ User ID: \${responseData.user?.id || responseData.agent_id}
✅ Email: \${responseData.user?.email}
✅ Name: \${responseData.agent_name || responseData.user?.firstName + ' ' + responseData.user?.lastName}
✅ Token: Generated and stored
✅ Subscription: \${responseData.user?.subscription || 'free'}

Ready to login! 🚀\`;
                    
                    if (responseData.access_token) {
                        localStorage.setItem('access_token', responseData.access_token);
                        localStorage.setItem('user_email', responseData.user?.email);
                        debug.innerHTML = '✅ Authentication token saved to browser storage';
                    }
                } else {
                    result.className = 'result error';
                    result.innerHTML = \`❌ SIGNUP FAILED

Error: \${responseData.error || 'Unknown error occurred'}

\${responseData.debug ? 'Debug Info:\\n' + JSON.stringify(responseData.debug, null, 2) : ''}
\${responseData.validation ? 'Validation:\\n' + JSON.stringify(responseData.validation, null, 2) : ''}
\${responseData.received ? 'Data Received:\\n' + JSON.stringify(responseData.received, null, 2) : ''}\`;
                }
            } catch (error) {
                console.error('💥 Network Error:', error);
                result.className = 'result error';
                result.innerHTML = \`💥 NETWORK ERROR

\${error.message}

This usually means:
• Server is not responding
• Network connection issue  
• CORS policy blocking request

Check browser console (F12) for details.\`;
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Create Account';
            }
        });
        
        // Test connectivity on load
        fetch('/api/health').then(r => r.json()).then(data => {
            console.log('🏥 Health Check:', data);
            debug.innerHTML = '✅ Server connection verified';
        }).catch(err => {
            console.error('❌ Health check failed:', err);
            debug.innerHTML = '❌ Server connection failed';
        });
    </script>
</body>
</html>`;
    
    res.status(200).send(html);
    
  } catch (error) {
    console.error('Error serving signup test:', error);
    res.status(500).json({ error: 'Failed to load signup test page' });
  }
};