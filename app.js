// Import Express.js
const express = require('express');

// Create an Express app
const app = express();

// Middleware to parse JSON bodies
app.use(express.json());

// Set port and verify_token
const port = process.env.PORT || 3000;
const verifyToken = process.env.VERIFY_TOKEN;

// Route for GET requests
app.get('/', (req, res) => {
  const { 'hub.mode': mode, 'hub.challenge': challenge, 'hub.verify_token': token } = req.query;

  if (mode === 'subscribe' && token === verifyToken) {
    console.log('WEBHOOK VERIFIED');
    res.status(200).send(challenge);
  } else {
    res.status(403).end();
  }
});

// Route for POST requests
app.post('/', (req, res) => {
  console.log(JSON.stringify(req.body, null, 2));

  const message =
    req.body.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.text?.body;

  const sender =
    req.body.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.from;

  if (message) {
    console.log('Sender:', sender);
    console.log('Message:', message);
  }

  res.status(200).send('EVENT_RECEIVED');
});

// Start the server
app.listen(port, () => {
  console.log(`\nListening on port ${port}\n`);
});
