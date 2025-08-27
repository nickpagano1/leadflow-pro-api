function togglePassword() {
    const passwordInput = document.getElementById('password');
    const toggleBtn = document.querySelector('.password-toggle');
    
    if (passwordInput.type === 'password') {
        passwordInput.type = 'text';
        toggleBtn.textContent = 'Hide';
    } else {
        passwordInput.type = 'password';
        toggleBtn.textContent = 'Show';
    }
}

function showError(message) {
    const errorDiv = document.getElementById('errorMessage');
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
}

function hideError() {
    const errorDiv = document.getElementById('errorMessage');
    errorDiv.style.display = 'none';
}

function setLoading(loading) {
    const submitBtn = document.getElementById('submitBtn');
    const spinner = document.getElementById('loadingSpinner');
    
    if (loading) {
        submitBtn.disabled = true;
        spinner.style.display = 'flex';
        submitBtn.textContent = '';
        submitBtn.appendChild(spinner);
    } else {
        submitBtn.disabled = false;
        spinner.style.display = 'none';
        submitBtn.textContent = 'Sign in';
    }
}

document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('loginForm');
    
    if (!form) {
        console.error('Login form not found!');
        return;
    }
    
    console.log('Login form JavaScript loaded');
    
    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        e.stopPropagation();
        
        hideError();
        setLoading(true);
        
        const formData = new FormData(e.target);
        const email = formData.get('email');
        const password = formData.get('password');
        
        try {
            console.log('Attempting login for:', email);
            
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    email: email,
                    password: password
                })
            });
            
            console.log('Login response status:', response.status);
            
            if (response.ok) {
                const data = await response.json();
                console.log('Login successful:', data);
                
                // Store the token
                localStorage.setItem('access_token', data.access_token);
                localStorage.setItem('agent', JSON.stringify(data.agent));
                
                console.log('Token stored:', data.access_token);
                
                // Redirect to dashboard
                window.location.href = '/dashboard';
                
            } else {
                const errorData = await response.json();
                console.error('Login failed:', errorData);
                showError(errorData.error || errorData.detail || 'Login failed. Please try again.');
            }
            
        } catch (error) {
            console.error('Login error:', error);
            showError('Network error. Please check your connection and try again.');
        } finally {
            setLoading(false);
        }
    });

    // Check if already logged in
    const token = localStorage.getItem('access_token');
    if (token) {
        console.log('Found existing token, redirecting to dashboard');
        window.location.href = '/dashboard';
    }
});