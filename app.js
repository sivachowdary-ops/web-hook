
const express = require('express');
const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');

const app = express();
app.use(express.json());

const port = process.env.PORT || 3000;
const verifyToken = process.env.VERIFY_TOKEN;

// Supabase Client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

// Astra AI Context
const BUSINESS_CONTEXT =
  "You are Astra, the WhatsApp AI assistant for Astra AI Solutions.\n\n" +
  "ABOUT US:\n" +
  "Astra AI Solutions helps businesses automate operations using AI and software.\n\n" +
  "OUR SERVICES:\n" +
  "1. WhatsApp AI Chatbots\n" +
  "2. AI Marketing Automation\n" +
  "3. Website Development\n" +
  "4. Social Media Automation\n" +
  "5. Lead Follow-Up Systems\n" +
  "6. Business Automation\n" +
  "7. Google Review Automation\n" +
  "8. Google & Meta Ads\n\n" +
  "RULES:\n" +
  "- You are Astra from Astra AI Solutions.\n" +
  "- Never say you are Gemini or Google.\n" +
  "- Keep responses short and conversational.\n" +
  "- If someone asks about pricing, offer a consultation.\n" +
  "- End responses with a helpful next step.";

// Save Conversation
async function saveConversation(phoneNumber, userMessage, aiResponse) {
  try {
    const { error } = await supabase
      .from('conversations')
      .insert([
        {
          phone_number: phoneNumber,
          user_message: userMessage,
          ai_response: aiResponse
        }
      ]);

    if (error) {
      console.error('Conversation Save Error:', error);
    } else {
      console.log('Conversation saved');
    }
  } catch (error) {
    console.error(error);
  }
}

// Save Lead
async function saveLead(phoneNumber, leadType, requirement) {
  try {
    const { error } = await supabase
      .from('leads')
      .insert([
        {
          phone_number: phoneNumber,
          lead_type: leadType,
          requirement: requirement
        }
      ]);

    if (error) {
      console.error('Lead Save Error:', error);
    } else {
      console.log('Lead saved:', leadType);
    }
  } catch (error) {
    console.error(error);
  }
}
async function saveBooking(
  phoneNumber,
  leadType,
  slot
) {
  try {
    const { error } = await supabase
      .from('bookings')
      .insert([
        {
          phone_number: phoneNumber,
          lead_type: leadType,
          slot_selected: slot
        }
      ]);

    if (error) {
      console.error(
        'Booking Error:',
        error
      );
    } else {
      console.log(
        'Booking saved'
      );
    }
  } catch (error) {
    console.error(error);
  }
}

// Create or Update Session
async function setUserSession(
  phoneNumber,
  currentStep,
  leadType = null
) {
  try {
    const { error } = await supabase
      .from('user_sessions')
      .upsert([
        {
          phone_number: phoneNumber,
          current_step: currentStep,
          lead_type: leadType
        }
      ]);

    if (error) {
      console.error('Session Error:', error);
    }
  } catch (error) {
    console.error(error);
  }
}

// Get Session
async function getUserSession(phoneNumber) {
  try {
    const { data, error } = await supabase
      .from('user_sessions')
      .select('*')
      .eq('phone_number', phoneNumber)
      .single();

    if (error) {
      return null;
    }

    return data;
  } catch (error) {
    return null;
  }
}

// Lead Detection
function detectLead(message) {
  const text = message.toLowerCase();

  if (
    text.includes('website') ||
    text.includes('web site') ||
    text.includes('landing page')
  ) {
    return 'Website Development';
  }

  if (
    text.includes('chatbot') ||
    text.includes('whatsapp bot') ||
    text.includes('whatsapp chatbot') ||
    text.includes('ai bot')
  ) {
    return 'WhatsApp Chatbot';
  }

  if (
    text.includes('marketing') ||
    text.includes('google ads') ||
    text.includes('facebook ads') ||
    text.includes('meta ads')
  ) {
    return 'Marketing';
  }

  if (
    text.includes('automation') ||
    text.includes('crm') ||
    text.includes('workflow') ||
    text.includes('follow up')
  ) {
    return 'Business Automation';
  }

  return null;
}

// Gemini Call
async function callGemini(model, userMessage) {
  const response = await axios.post(
    "https://generativelanguage.googleapis.com/v1beta/models/" +
      model +
      ":generateContent?key=" +
      process.env.GEMINI_API_KEY,
    {
      contents: [
        {
          parts: [
            {
              text:
                BUSINESS_CONTEXT +
                "\n\nUser Message: " +
                userMessage
            }
          ]
        }
      ]
    }
  );

  return response.data.candidates[0].content.parts[0].text;
}

// Gemini Response
async function getGeminiResponse(userMessage) {
  const models = [
    'gemini-2.5-flash',
    'gemini-2.0-flash',
    'gemini-2.5-flash-lite'
  ];

  for (let i = 0; i < models.length; i++) {
    const model = models[i];

    try {
      const result = await callGemini(
        model,
        userMessage
      );

      console.log(
        'Success with model:',
        model
      );

      return result;
    } catch (error) {
      console.error(
        'Gemini Error:',
        error.response?.data ||
          error.message
      );
    }
  }

  return 'Sorry, I am having trouble responding right now.';
}

// Send WhatsApp Message
async function sendWhatsAppMessage(
  to,
  message
) {
  try {
    await axios.post(
      "https://graph.facebook.com/v23.0/" +
        process.env.PHONE_NUMBER_ID +
        "/messages",
      {
        messaging_product: 'whatsapp',
        to: to,
        text: {
          body: message
        }
      },
      {
        headers: {
          Authorization:
            'Bearer ' +
            process.env.WHATSAPP_TOKEN,
          'Content-Type':
            'application/json'
        }
      }
    );

    console.log(
      'Reply sent successfully'
    );
  } catch (error) {
    console.error(
      'WhatsApp Error:',
      error.response?.data ||
        error.message
    );
  }
}

// Verification Route
app.get('/', (req, res) => {
  const mode = req.query['hub.mode'];
  const challenge =
    req.query['hub.challenge'];
  const token =
    req.query['hub.verify_token'];

  if (
    mode === 'subscribe' &&
    token === verifyToken
  ) {
    console.log('WEBHOOK VERIFIED');
    res.status(200).send(challenge);
  } else {
    res.status(403).end();
  }
});

// Incoming Messages
app.post('/', async (req, res) => {
  console.log(
    JSON.stringify(req.body, null, 2)
  );

  const message =
    req.body.entry?.[0]?.changes?.[0]
      ?.value?.messages?.[0]?.text
      ?.body;

  const sender =
    req.body.entry?.[0]?.changes?.[0]
      ?.value?.messages?.[0]?.from;
  
  const session = await getUserSession(sender);


if (message) {
  console.log('Sender:', sender);
  console.log('Message:', message);

  // If waiting for user's name
if (
  session &&
  session.current_step === 'awaiting_name'
) {
  const { error } = await supabase
    .from('qualified_leads')
    .upsert([
      {
        phone_number: sender,
        name: message,
        lead_type: session.lead_type
      }
    ]);

  if (error) {
    console.error(
      'Qualified Lead Error:',
      error
    );
  }

  await setUserSession(
    sender,
    'awaiting_business_name',
    session.lead_type
  );

  await sendWhatsAppMessage(
    sender,
    'Thank you. What is your business name?'
  );

  return res.status(200).send(
    'EVENT_RECEIVED'
  );
}

if (
  session &&
  session.current_step === 'awaiting_business_name'
) {
  const { error } = await supabase
    .from('qualified_leads')
    .update({
      business_name: message
    })
    .eq('phone_number', sender);

  if (error) {
    console.error(
      'Business Name Error:',
      error
    );
  }

  await setUserSession(
    sender,
    'awaiting_call_confirmation',
    session.lead_type
  );

  await sendWhatsAppMessage(
    sender,
    'Thank you. Would you like to schedule a free consultation call with our team? Reply YES or NO.'
  );

  return res.status(200).send(
    'EVENT_RECEIVED'
  );
}
if (
  session &&
  session.current_step === 'awaiting_call_confirmation'
) {
  const reply = message.trim().toLowerCase();

  if (
    reply === 'yes' ||
    reply === 'y'
  ) {
    await supabase
      .from('qualified_leads')
      .update({
        call_requested: true
      })
      .eq('phone_number', sender);

    await setUserSession(
      sender,
      'awaiting_slot_selection',
      session.lead_type
    );

    await sendWhatsAppMessage(
      sender,
      'Great! Here are our next available slots:\n\n1. Today - 5:00 PM\n2. Today - 6:00 PM\n3. Tomorrow - 11:00 AM\n4. Tomorrow - 4:00 PM\n\nReply with 1, 2, 3 or 4.'
    );

    return res.status(200).send(
      'EVENT_RECEIVED'
    );
  }

  if (
    reply === 'no' ||
    reply === 'n'
  ) {
    await sendWhatsAppMessage(
      sender,
      'No problem. If you would like a consultation later, just let us know.'
    );

    return res.status(200).send(
      'EVENT_RECEIVED'
    );
  }
if (
  session &&
  session.current_step === 'awaiting_slot_selection'
) {
  const slots = {
    '1': 'Today - 5:00 PM',
    '2': 'Today - 6:00 PM',
    '3': 'Tomorrow - 11:00 AM',
    '4': 'Tomorrow - 4:00 PM'
  };

  const selectedSlot =
    slots[message.trim()];

  if (!selectedSlot) {
    await sendWhatsAppMessage(
      sender,
      'Please select 1, 2, 3 or 4.'
    );

    return res.status(200).send(
      'EVENT_RECEIVED'
    );
  }

  await saveBooking(
    sender,
    session.lead_type,
    selectedSlot
  );

  await sendWhatsAppMessage(
    sender,
    `Perfect! Your consultation has been scheduled for ${selectedSlot}. Our team will contact you shortly.`
  );

  return res.status(200).send(
    'EVENT_RECEIVED'
  );
}


  await sendWhatsAppMessage(
    sender,
    'Please reply YES or NO.'
  );

  return res.status(200).send(
    'EVENT_RECEIVED'
  );
}
  await sendWhatsAppMessage(
    sender,
    aiResponse
  );
}
res.status(200).send(
  'EVENT_RECEIVED'
);
});
// Start Server
app.listen(port, () => {
  console.log(
    'Listening on port ' + port
  );
});

