document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('signupForm');
    const submitBtn = document.querySelector('button[type="submit"]');
    
    if (!form) {
        console.error('Signup form not found!');
        return;
    }
    
    console.log('Signup form JavaScript loaded');
    
    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        e.stopPropagation();
        
        console.log('Form submitted!');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Creating Account...';
        
        const data = {
            email: document.getElementById('email').value,
            first_name: document.getElementById('firstName').value,
            last_name: document.getElementById('lastName').value,
            company: document.getElementById('company').value,
            password: document.getElementById('password').value,
            phone: '5551234567',
            plan: 'premium'
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
                localStorage.setItem('agent_id', result.agent_id);
                localStorage.setItem('agent_name', result.agent_name);
                alert('Account created successfully!');
                window.location.href = '/dashboard';
            } else {
                alert('Error: ' + (result.error || result.detail || 'Signup failed'));
            }
        } catch (error) {
            console.error('Signup error:', error);
            alert('Error: ' + error.message);
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Create Account';
        }
    });
});