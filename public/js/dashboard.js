// Dashboard authentication and functionality
document.addEventListener('DOMContentLoaded', function() {
    console.log('Dashboard JavaScript loaded');
    
    // Check authentication
    const token = localStorage.getItem('access_token');
    const agent = localStorage.getItem('agent');
    
    if (!token) {
        console.log('No token found, redirecting to login');
        window.location.href = '/login';
        return;
    }
    
    // Display user info if available
    if (agent) {
        try {
            const agentData = JSON.parse(agent);
            const userNameElement = document.querySelector('[data-user-name]');
            const userEmailElement = document.querySelector('[data-user-email]');
            
            if (userNameElement) {
                userNameElement.textContent = `${agentData.firstName} ${agentData.lastName}`;
            }
            if (userEmailElement) {
                userEmailElement.textContent = agentData.email;
            }
        } catch (error) {
            console.error('Error parsing agent data:', error);
        }
    }
    
    // Load dashboard data
    loadDashboardData();
    
    // Logout functionality
    const logoutBtns = document.querySelectorAll('[data-logout]');
    logoutBtns.forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.preventDefault();
            logout();
        });
    });
});

async function loadDashboardData() {
    const token = localStorage.getItem('access_token');
    
    try {
        // Load stats
        const statsResponse = await fetch('/api/stats', {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (statsResponse.ok) {
            const stats = await statsResponse.json();
            updateDashboardStats(stats);
        } else if (statsResponse.status === 401) {
            // Token expired
            logout();
            return;
        }
        
        // Load recent leads
        const leadsResponse = await fetch('/api/leads?limit=5', {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (leadsResponse.ok) {
            const leadsData = await leadsResponse.json();
            updateRecentLeads(leadsData.leads);
        }
        
    } catch (error) {
        console.error('Error loading dashboard data:', error);
    }
}

function updateDashboardStats(stats) {
    const elements = {
        totalLeads: document.querySelector('[data-total-leads]'),
        newLeads: document.querySelector('[data-new-leads]'),
        convertedLeads: document.querySelector('[data-converted-leads]'),
        totalCampaigns: document.querySelector('[data-total-campaigns]'),
        conversionRate: document.querySelector('[data-conversion-rate]')
    };
    
    if (stats.overview) {
        Object.keys(elements).forEach(key => {
            if (elements[key] && stats.overview[key] !== undefined) {
                elements[key].textContent = stats.overview[key];
            }
        });
    }
}

function updateRecentLeads(leads) {
    const container = document.querySelector('[data-recent-leads]');
    if (!container || !leads) return;
    
    container.innerHTML = leads.map(lead => `
        <div class="lead-item">
            <div class="lead-info">
                <strong>${lead.firstName || ''} ${lead.lastName || ''}</strong>
                <span>${lead.email}</span>
            </div>
            <div class="lead-status status-${lead.status}">${lead.status}</div>
        </div>
    `).join('');
}

function logout() {
    localStorage.removeItem('access_token');
    localStorage.removeItem('agent');
    localStorage.removeItem('agent_id');
    localStorage.removeItem('agent_name');
    
    console.log('Logged out, redirecting to home');
    window.location.href = '/';
}