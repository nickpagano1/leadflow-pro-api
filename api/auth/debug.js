// Ultra-simple debug endpoint to see what we're receiving
module.exports = async (req, res) => {
  try {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    // Log everything about the request
    console.log('=== DEBUG REQUEST ===');
    console.log('Method:', req.method);
    console.log('Headers:', req.headers);
    console.log('Raw body:', req.body);
    console.log('Body type:', typeof req.body);
    console.log('Body constructor:', req.body?.constructor?.name);
    
    if (req.body) {
      console.log('Body keys:', Object.keys(req.body));
      console.log('Body values:', Object.values(req.body));
    }

    res.json({
      message: 'Debug endpoint',
      method: req.method,
      headers: req.headers,
      body: req.body,
      bodyType: typeof req.body,
      bodyKeys: req.body ? Object.keys(req.body) : null,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    res.status(500).json({
      error: 'Debug failed',
      message: error.message
    });
  }
};