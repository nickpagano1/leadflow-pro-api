const fs = require('fs');
const path = require('path');

module.exports = async (req, res) => {
  try {
    // Set proper headers for JavaScript
    res.setHeader('Content-Type', 'application/javascript');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    
    // Read the signup.js file from public directory
    const filePath = path.join(process.cwd(), 'public', 'js', 'signup.js');
    const fileContent = fs.readFileSync(filePath, 'utf8');
    
    res.status(200).send(fileContent);
  } catch (error) {
    console.error('Error serving signup.js:', error);
    res.status(404).json({ error: 'File not found' });
  }
};