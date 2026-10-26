import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Rate limiting state (in-memory per Deno isolate)
// Window: 60 seconds; Max requests: 10 requests per user
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 10;
const MAX_MESSAGE_LENGTH = 500;
const userRateLimitMap = new Map<string, number[]>();

interface ChatRequestBody {
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  context?: {
    isLoggedIn: boolean;
    userName?: string;
    userEmail?: string;
    bookings?: Array<{
      id: string;
      status: string;
      statusLabel: string;
      preferredDate: string;
      timeSlot: string;
      estimatedTotal: number;
      itemsSummary: string;
    }>;
    ratesSummary?: string;
  };
  language?: 'hinglish' | 'english';
}

serve(async (req) => {
  // 1. Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // 2. Enforce Authentication (JWT verification)
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({
          error: 'Unauthorized: Authentication required. Please sign in to use AI chat.',
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 401,
        }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });

    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser();

    if (userError || !user) {
      return new Response(
        JSON.stringify({
          error: 'Unauthorized: Invalid or expired authentication token. Please sign in again.',
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 401,
        }
      );
    }

    // 3. Per-user Rate Limiting
    const userId = user.id;
    const now = Date.now();
    const timestamps = (userRateLimitMap.get(userId) || []).filter(
      (ts) => now - ts < RATE_LIMIT_WINDOW_MS
    );

    if (timestamps.length >= MAX_REQUESTS_PER_WINDOW) {
      return new Response(
        JSON.stringify({
          error: 'Rate limit exceeded: You have sent too many messages in a short time. Please wait a minute before trying again.',
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 429,
        }
      );
    }

    timestamps.push(now);
    userRateLimitMap.set(userId, timestamps);

    // 4. Request Payload & Message Length Validation
    const body: ChatRequestBody = await req.json();
    const { messages, context, language } = body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Bad Request: No conversation messages provided.' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      );
    }

    const latestUserMsg = messages[messages.length - 1];
    if (latestUserMsg?.content && latestUserMsg.content.length > MAX_MESSAGE_LENGTH) {
      return new Response(
        JSON.stringify({
          error: `Message too long: Your message is ${latestUserMsg.content.length} characters. The maximum allowed length is ${MAX_MESSAGE_LENGTH} characters.`,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      );
    }

    // 5. OpenAI Secret Check
    const apiKey = Deno.env.get('OPENAI_API_KEY');
    if (!apiKey || apiKey.trim() === '') {
      return new Response(
        JSON.stringify({
          setupRequired: true,
          message: 'OPENAI_API_KEY is not configured on Supabase Edge Function secrets.',
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    // 6. Assemble Verified Context
    const userDisplayName =
      user.user_metadata?.full_name || user.email?.split('@')[0] || 'Customer';

    const userStatusText = `AUTHENTICATED USER: ${userDisplayName} (${user.email})\nUSER'S RECENT ORDERS:\n${
      context?.bookings && context.bookings.length > 0
        ? context.bookings
            .map(
              (b) =>
                `- Order #${b.id}: Status: ${b.statusLabel} | Scheduled: ${b.preferredDate} (${b.timeSlot}) | Items: ${b.itemsSummary} | Est. ₹${b.estimatedTotal}`
            )
            .join('\n')
        : 'No active bookings found for this account.'
    }`;

    const systemPrompt = `
You are the official UrbanScrap AI Support Assistant for UrbanScrap (India's doorstep digital scrap collection and recycling platform).

PRIMARY RULES & BEHAVIOR:
1. LANGUAGE:
   - If the user talks in Hinglish (Hindi written in Roman script) or Hindi, answer in warm, friendly, natural Hinglish.
   - If the user writes in English, reply in clean, professional English.

2. ACCURATE INDICATIVE SCRAP RATES:
   - Use ONLY the following real indicative scrap rates:
${context?.ratesSummary || 'Newspaper: ₹14/kg, Cardboard: ₹11/kg, PET Bottles: ₹18/kg, Iron: ₹28/kg, Aluminium: ₹110/kg, Copper: ₹420/kg, Small E-waste: ₹35/kg, Lead-Acid Batteries: ₹65/kg, Heavy Appliances: ₹250/piece'}
   - MANDATORY PRICING RULE: Always remind the customer that scrap rates shown on the website/app are indicative benchmarks. The exact payout is finalized on-site after digital scale weighing and physical material inspection by the verified partner.

3. BOOKING PROCESS GUIDANCE:
   - Step 1: Select scrap categories and approximate quantity on the Book Pickup page.
   - Step 2: Enter doorstep pickup address and pincode.
   - Step 3: Choose a convenient date and time window (Morning, Afternoon, Evening).
   - Step 4: A verified local scrap merchant is assigned to the request.
   - Step 5: Partner arrives with certified digital weighing scale and provides instant spot payout (UPI / Cash).

4. USER ORDERS & DATA PRIVACY:
   ${userStatusText}
   - Only discuss the orders listed above for this specific user (${user.email}).
   - Never reveal other customers' names, phone numbers, or bookings.

5. STRICT SAFETY & NON-MUTATION CONSTRAINTS:
   - You are strictly an informational assistant.
   - You CANNOT change booking status, cancel bookings, assign dealers, approve dealer applications, verify GSTIN, or process money transfers.
   - For actions like scheduling a pickup or reviewing applications, direct the user to the appropriate page (/book, /prices, /bookings, /dealer).

6. TONE:
   - Helpful, polite, and encouraging of eco-friendly recycling.
   - Keep answers concise and well-formatted with bullet points when explaining steps or lists.
`.trim();

    // 7. Request OpenAI Chat Completion
    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0.3,
        max_tokens: 450,
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages.slice(-6),
        ],
      }),
    });

    if (!openaiResponse.ok) {
      const errorText = await openaiResponse.text();
      console.error('OpenAI API error:', openaiResponse.status, errorText);

      return new Response(
        JSON.stringify({
          setupRequired: true,
          error: `OpenAI API returned status ${openaiResponse.status}`,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    const data = await openaiResponse.json();
    const replyText =
      data.choices?.[0]?.message?.content ||
      'How can I assist you with UrbanScrap today?';

    return new Response(
      JSON.stringify({
        reply: replyText,
        isFallback: false,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error('Server error in chat-support Edge Function:', error);
    return new Response(
      JSON.stringify({
        error: error.message || 'Internal server error',
        setupRequired: true,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
