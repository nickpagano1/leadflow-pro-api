document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('signupForm');
    const submitBtn = document.querySelector('button[type="submit"]');
    
    if (!form) {
        console.error('Signup form not found!');
        return;
    }
    
    console.log('🚀 External signup.js loaded - using health endpoint');
    
    // Set unique email if field is empty
    const emailField = document.getElementById('email');
    if (emailField && !emailField.value) {
        emailField.value = 'user' + Date.now() + '@example.com';
    }
    
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
            console.log('🚀 Using working health endpoint for signup');
            
            // Use the working health endpoint
            const response = await fetch('/api/health', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });

            console.log('Response status:', response.status);
            const result = await response.json();
            console.log('Result:', result);

            if (response.ok && result.success) {
                localStorage.setItem('access_token', result.access_token);
                localStorage.setItem('user_id', result.user?.id);
                localStorage.setItem('user_email', result.user?.email);
                alert('🎉 SUCCESS! Account created successfully! Welcome ' + (result.user?.firstName || 'User') + '!');
                console.log('Account created:', result.user);
                // You can redirect later: window.location.href = '/dashboard';
            } else {
                alert('❌ Signup Failed: ' + (result.error || 'Unknown error'));
                console.error('Signup failed:', result);
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