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
        
        const emailField = document.getElementById('email');
        const firstNameField = document.getElementById('firstName');
        const lastNameField = document.getElementById('lastName');
        const companyField = document.getElementById('company');
        const passwordField = document.getElementById('password');
        
        console.log('Field values:');
        console.log('Email:', emailField ? emailField.value : 'FIELD NOT FOUND');
        console.log('First Name:', firstNameField ? firstNameField.value : 'FIELD NOT FOUND');
        console.log('Last Name:', lastNameField ? lastNameField.value : 'FIELD NOT FOUND');
        console.log('Company:', companyField ? companyField.value : 'FIELD NOT FOUND');
        console.log('Password:', passwordField ? passwordField.value.length + ' characters' : 'FIELD NOT FOUND');
        
        const data = {
            email: emailField ? emailField.value : '',
            first_name: firstNameField ? firstNameField.value : '',
            last_name: lastNameField ? lastNameField.value : '',
            company: companyField ? companyField.value : '',
            password: passwordField ? passwordField.value : '',
            phone: '5551234567',
            plan: 'premium'
        };

        console.log('Sending data:', data);

        try {
            // First test debug endpoint
            console.log('Testing debug endpoint first...');
            const debugResponse = await fetch('/api/auth/debug', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            const debugResult = await debugResponse.json();
            console.log('Debug result:', debugResult);
            
            // Try the simple signup endpoint instead
            const response = await fetch('/api/auth/signup-simple', {
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