module.exports = async (req, res) => {
  try {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    
    const html = `<!DOCTYPE html>
<html>
<head>
    <title>Test Signup - LeadFlow Pro</title>
    <style>
        body { font-family: Arial, sans-serif; max-width: 400px; margin: 50px auto; padding: 20px; }
        .form-group { margin-bottom: 15px; }
        label { display: block; margin-bottom: 5px; font-weight: bold; }
        input { width: 100%; padding: 10px; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box; }
        button { width: 100%; padding: 12px; background: #000; color: white; border: none; border-radius: 4px; cursor: pointer; }
        button:hover { background: #333; }
        .result { margin-top: 20px; padding: 10px; border-radius: 4px; }
        .success { background: #d4edda; color: #155724; border: 1px solid #c3e6cb; }
        .error { background: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; }
    </style>
</head>
<body>
    <h1>Test Signup Form</h1>
    <p>Direct test of signup functionality</p>
    
    <form id="testForm">
        <div class="form-group">
            <label>Email:</label>
            <input type="email" id="email" required>
        </div>
        
        <div class="form-group">
            <label>First Name:</label>
            <input type="text" id="firstName" required>
        </div>
        
        <div class="form-group">
            <label>Last Name:</label>
            <input type="text" id="lastName" required>
        </div>
        
        <div class="form-group">
            <label>Company:</label>
            <input type="text" id="company" required>
        </div>
        
        <div class="form-group">
            <label>Password:</label>
            <input type="password" id="password" required>
        </div>
        
        <button type="submit" id="submitBtn">Create Account</button>
    </form>
    
    <div id="result"></div>

    <script>
        document.getElementById('testForm').addEventListener('submit', async function(e) {
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
            
            console.log('Sending data:', data);
            
            try {
                const response = await fetch('/api/auth/signup', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });
                
                console.log('Response status:', response.status);
                const responseData = await response.json();
                console.log('Response data:', responseData);
                
                if (response.ok && responseData.success) {
                    result.className = 'result success';
                    result.innerHTML = '<strong>SUCCESS!</strong><br>' + 
                                     'Account created successfully!<br>' +
                                     'Token: ' + (responseData.access_token ? 'Generated' : 'Missing');
                    localStorage.setItem('access_token', responseData.access_token);
                } else {
                    result.className = 'result error';
                    result.innerHTML = '<strong>ERROR:</strong><br>' + 
                                     JSON.stringify(responseData, null, 2);
                }
            } catch (error) {
                console.error('Error:', error);
                result.className = 'result error';
                result.innerHTML = '<strong>NETWORK ERROR:</strong><br>' + error.message;
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Create Account';
            }
        });
        
        console.log('Test form loaded successfully');
    </script>
</body>
</html>`;
    
    res.status(200).send(html);
    
  } catch (error) {
    res.status(500).json({ error: 'Failed to load test form' });
  }
};