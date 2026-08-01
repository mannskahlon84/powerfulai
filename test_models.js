const https = require('https');

const API_KEY = process.env.GEMINI_API_KEY || 'your-api-key-here'; // We will replace this with their actual key from test_live.py

https.get(`https://generativelanguage.googleapis.com/v1beta/models?key=${API_KEY}`, (resp) => {
  let data = '';
  resp.on('data', (chunk) => { data += chunk; });
  resp.on('end', () => {
    try {
      const json = JSON.parse(data);
      if (json.models) {
        const bidiModels = json.models.filter(m => 
          m.supportedGenerationMethods && m.supportedGenerationMethods.includes('bidiGenerateContent')
        );
        console.log("Models supporting bidiGenerateContent:");
        bidiModels.forEach(m => console.log(m.name));
      } else {
        console.log("No models array found.", json);
      }
    } catch (e) {
      console.log("Error parsing JSON:", e.message);
    }
  });
}).on("error", (err) => {
  console.log("Error: " + err.message);
});
