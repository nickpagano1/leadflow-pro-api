const fs = require('fs');
const path = require('path');

module.exports = async (req, res) => {
  try {
    // Extract the file path from the URL
    const urlPath = req.url || '';
    console.log('JS request URL:', urlPath);
    
    // Handle /js/signup.js specifically
    if (urlPath === '/signup.js' || urlPath.endsWith('/signup.js')) {
      // Set proper headers for JavaScript
      res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Access-Control-Allow-Origin', '*');
      
      // Read the signup.js content from public directory
      const filePath = path.join(process.cwd(), 'public', 'js', 'signup.js');
      
      if (fs.existsSync(filePath)) {
        const fileContent = fs.readFileSync(filePath, 'utf8');
        console.log('Serving signup.js, length:', fileContent.length);
        return res.status(200).send(fileContent);
      } else {
        // Fallback: serve inline JavaScript
        const inlineJS = `
document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('signupForm');
    const submitBtn = document.querySelector('button[type="submit"]');
    
    if (!form) {
        console.error('Signup form not found!');
        return;
    }
    
    console.log('Signup form JavaScript loaded via API');
    
    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        e.stopPropagation();
        
        console.log('Form submitted!');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Creating Account...';
        
        const emailField = document.getElementById('email');
        const firstNameField = document.getElementById('firstName');
        const lastNameField = document.getElementById('lastName');
        const companyField = document.getElementById('company');
        const passwordField = document.getElementById('password');
        
        const data = {
            email: emailField ? emailField.value : '',
            first_name: firstNameField ? firstNameField.value : '',
            last_name: lastNameField ? lastNameField.value : '',
            company: companyField ? companyField.value : '',
            password: passwordField ? passwordField.value : '',
        };

        console.log('Sending data:', data);

        try {
            const response = await fetch('/api/auth/signup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });

            console.log('Response status:', response.status);
            const result = await response.json();
            console.log('Result:', result);

            if (response.ok && result.success) {
                localStorage.setItem('access_token', result.access_token);
                alert('Account created successfully!');
                window.location.href = '/dashboard';
            } else {
                alert('Error: ' + (result.error || 'Signup failed'));
                console.error('Signup error details:', result);
            }
        } catch (error) {
            console.error('Signup error:', error);
            alert('Error: ' + error.message);
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Create Account';
        }
    });
});`;
        
        console.log('Serving fallback inline JavaScript');
        return res.status(200).send(inlineJS);
      }
    }
    
    // If not signup.js, return 404
    res.status(404).send('console.error("JavaScript file not found");');
    
  } catch (error) {
    console.error('Error serving JS:', error);
    res.status(500).send('console.error("Failed to load JavaScript");');
  }
};