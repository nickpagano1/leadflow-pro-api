document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('signupForm');
    const submitBtn = document.querySelector('button[type="submit"]');
    
    if (!form) {
        console.error('Signup form not found!');
        return;
    }
    
    console.log('Signup form JavaScript loaded successfully');
    
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
});