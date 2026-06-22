const express = require('express');
const axios = require('axios');
const app = express();
app.use(express.json());
const port = process.env.PORT || 3000;
const verifyToken = process.env.VERIFY_TOKEN;

const BUSINESS_CONTEXT = `
You are the AI assistant for Astra AI Solutions.

About Astra AI Solutions:
We help businesses automate operations using AI and modern software solutions.

Our Services:
1. WhatsApp AI Chatbots
2. AI Marketing Automation
3. Website Development
4. Social Media Automation
5. Lead Follow-Up Systems
6. Business Automation
7. Google Review Automation
8. Google & Meta Ads

Guidelines:
- Always be professional and helpful.
- Represent Astra AI Solutions.
- Explain our services when asked.
- If pricing is requested, explain that pricing depends on requirements and recommend booking a consultation.
- Encourage users to schedule a call when they are interested.
- Keep responses concise and business-focused.
`;

// Gemini Function
async function getGeminiResponse(userMessage) {
  try {
    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        contents: [
          {
            parts: [
              {
                text: `${BUSINESS_CONTEXT}\nUser Message: ${userMessage}`
              }
            ]
          }
        ]
      }
    );
    return response.data.candidates[0].content.parts[0].text;
  } catch (error) {
    console.error(
      "Gemini Error:",
      error.response?.data || error.message
    );
    return "Sorry, I'm having trouble responding right now. Please try again later.";
  }
}

// Send WhatsApp Message
async function sendWhatsAppMessage(to, message) {
  try {
    await axios.post(
      `https://graph.facebook.com/v23.0/${process.env.PHONE_NUMBER_ID}/messages`,
      {
        messaging_product: "whatsapp",
        to: to,
        text: {
          body: message
        }
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
          "Content-Type": "application/json"
        }
      }
    );
    console.log("Reply sent successfully");
  } catch (error) {
    console.error(
      "Error sending message:",
      error.response?.data || error.message
    );
  }
}

// Webhook Verification
app.get('/', (req, res) => {
  const {
    'hub.mode': mode,
    'hub.challenge': challenge,
    'hub.verify_token': token
  } = req.query;
  if (mode === 'subscribe' && token === verifyToken) {
    console.log('WEBHOOK VERIFIED');
    res.status(200).send(challenge);
  } else {
    res.status(403).end();
  }
});

// Incoming WhatsApp Messages
app.post('/', async (req, res) => {
  console.log(JSON.stringify(req.body, null, 2));
  const message =
    req.body.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.text?.body;
  const sender =
    req.body.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.from;
  if (message) {
    console.log('Sender:', sender);
    console.log('Message:', message);
    const aiResponse = await getGeminiResponse(message);
    console.log('AI Response:', aiResponse);
    await sendWhatsAppMessage(
      sender,
      aiResponse
    );
  }
  res.status(200).send('EVENT_RECEIVED');
});

// Start Server
app.listen(port, () => {
  console.log(`Listening on port ${port}`);
});
