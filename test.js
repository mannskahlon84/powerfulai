const res = await fetch('https://powerfulai.netlify.app/.netlify/functions/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ messages: [{ role: 'user', content: 'hello' }] })
});
const text = await res.text();
console.log('Status:', res.status);
console.log('Body:', text);
