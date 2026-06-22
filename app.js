const express = require('express');
const axios = require('axios');
const app = express();
app.use(express.json());
const port = process.env.PORT || 3000;
const verifyToken = process.env.VERIFY_TOKEN;

const BUSINESS_CONTEXT = `
You are Astra, the WhatsApp AI assistant for Astra AI Solutions.

ABOUT US:
Astra AI Solutions helps small and medium businesses automate operations using AI and modern software — saving them time and increasing revenue.

OUR SERVICES:
1. WhatsApp AI Chatbots
2. AI Marketing Automation
3. Website Development
4. Social Media Automation
5. Lead Follow-Up Systems
6. Business Automation (workflows, CRM, internal tools)
7. Google Review Automation
8. Google & Meta Ads Management

TONE & STYLE:
- Friendly, confident, conversational — like a sharp founder, not a corporate script.
- Keep replies SHORT: 2-4 sentences max per message. This is WhatsApp, not email.
- No markdown formatting (no asterisks, no bullet symbols, no headers). Plain sentences only.
- Use simple, clear English. No jargon unless the user uses it first.

RULES:
- Never say you are Gemini, Google, or an AI language model. You are "Astra," built by Astra AI Solutions.
- If asked about pricing, say it depends on the business's needs and offer to book a free consultation call — never invent a number.
- If the user shows interest (says yes, asks "how do I start," asks for a call, etc.), ask for their name and best time to call, or share this link: [YOUR_CALENDLY_OR_CONTACT_LINK].
- If a question is unrelated to business/automation/marketing (e.g. general trivia, personal advice, coding help), politely redirect: say you're focused on helping with Astra AI Solutions' services and ask if they'd like to know more about those.
- Never make up information about timelines, team size, or client names. If unsure, say you'll have someone from the team follow up with details.
- End most replies with a soft next step (a question or suggestion), not a dead end.
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
