# UrbanScrap AI Support Chatbot Setup & Deployment Guide

This document explains the architecture, security model, and setup instructions for the **UrbanScrap AI Support Chatbot**.

---

## 1. Architecture & Security Highlights

1. **Zero Secret Leakage**:
   - The `OPENAI_API_KEY` is **never** included in frontend code, `.env`, or browser requests.
   - Requests are routed to a server-side **Supabase Edge Function** (`chat-support`), which securely queries OpenAI using `Deno.env.get('OPENAI_API_KEY')`.
2. **Deterministic Fallback Engine**:
   - If the Edge Function has not been deployed yet or the API key is not configured, the widget transparently switches to the **UrbanScrap Verified Knowledge Base**.
   - It answers real indicative rates, explains booking steps, explains dealer verification, and reads the signed-in user's bookings with full Supabase Row-Level Security (RLS).
   - It clearly identifies itself as operating in Knowledge Base Mode rather than pretending to be an active LLM.
3. **Data Protection & Read-Only Safety**:
   - The chatbot is **strictly read-only**. It cannot update booking statuses, claim orders, approve dealers, verify GSTINs, or initiate payouts.
   - Guest users cannot see any booking records and are prompted to sign in first.
   - Indicative pricing disclaimers are always presented (final value is determined on-site via digital weighing scales and physical inspection).
4. **Bilingual Support**:
   - Automatically detects and responds in **English** or **Hinglish** based on the user's input.

---

## 2. Setting up the OpenAI Secret in Supabase

You need an OpenAI API key (from [platform.openai.com](https://platform.openai.com/api-keys)).

### Option A: Via Supabase CLI (Recommended)

Run the following command in your terminal from the project root:

```bash
# Link to your Supabase project (if not already linked)
npx supabase link --project-ref YOUR_PROJECT_REF

# Set the OPENAI_API_KEY secret
npx supabase secrets set OPENAI_API_KEY="sk-proj-your-actual-openai-api-key"
```

To verify that the secret is registered:
```bash
npx supabase secrets list
```

### Option B: Via Supabase Web Dashboard

1. Open your [Supabase Dashboard](https://supabase.com/dashboard).
2. Select your **UrbanScrap** project.
3. In the left navigation, go to **Project Settings** (gear icon) → **Edge Functions** (or **Edge Functions** tab in the main sidebar).
4. Click **Manage Secrets** / **Add Secret**.
5. Set Name: `OPENAI_API_KEY`
6. Set Value: `sk-proj-your-actual-openai-api-key`
7. Click **Save**.

---

## 3. Deploying the Supabase Edge Function (JWT Verification Enabled)

JWT verification is configured and enforced in [`supabase/config.toml`](file:///c:/Users/aarish/OneDrive/Desktop/UrbanScrap/supabase/config.toml) with `verify_jwt = true`.

Deploy the function using the standard Supabase CLI deploy command:

```bash
npx supabase functions deploy chat-support
```

> [!IMPORTANT]
> **Do NOT deploy with `--no-verify-jwt`**. 
> - JWT verification is strictly enabled (`verify_jwt = true`).
> - Only authenticated, signed-in users can execute the AI function.
> - Guests automatically and seamlessly query the **UrbanScrap Verified Knowledge Base** client-side, eliminating unnecessary token usage and keeping API access secured.
> - **Abuse Protection**: The Edge Function enforces a **500-character message length limit** and a **per-user rate limit of 10 requests per minute**.

---

## 4. Testing the Chatbot

1. **Start the local development server**:
   ```bash
   npm run dev
   ```
2. Open `http://localhost:5173`.
3. Click the floating **Ask UrbanScrap** button at the bottom-right of the screen.
4. Try prompt examples:
   - **Indicative Rates**: `"What are today's newspaper and copper scrap rates?"`
   - **Hinglish Rates**: `"Bhai loha aur raddi ka rate kya chal raha hai?"`
   - **Pickup Guidance**: `"How do I book a doorstep pickup?"`
   - **Dealer Onboarding**: `"How does dealer GST verification work?"`
   - **Booking Status**:
     - As a guest: `"Check my booking status"` (will prompt you to Sign In).
     - As a signed-in user with bookings: `"Check my booking status"` (will list your real bookings securely).

---

## 5. Summary of Files Created & Modified

| File | Purpose |
|---|---|
| [`src/components/chat/SupportChatWidget.tsx`](file:///c:/Users/aarish/OneDrive/Desktop/UrbanScrap/src/components/chat/SupportChatWidget.tsx) | Responsive, floating chat widget with welcome screen, suggested prompts, quick chips, action buttons, and conversation reset. |
| [`src/utils/aiSupport.ts`](file:///c:/Users/aarish/OneDrive/Desktop/UrbanScrap/src/utils/aiSupport.ts) | Language detection (Hinglish/English), live rates retriever, user bookings context loader with RLS, knowledge base fallback, and edge function invoker. |
| [`src/App.tsx`](file:///c:/Users/aarish/OneDrive/Desktop/UrbanScrap/src/App.tsx) | Integrated `SupportChatWidget` across customer-facing routes inside `AuthProvider`. |
| [`supabase/functions/chat-support/index.ts`](file:///c:/Users/aarish/OneDrive/Desktop/UrbanScrap/supabase/functions/chat-support/index.ts) | Serverless Supabase Edge Function executing OpenAI `gpt-4o-mini` with strict system constraints. |
| [`SUPABASE_CHATBOT_SETUP.md`](file:///c:/Users/aarish/OneDrive/Desktop/UrbanScrap/SUPABASE_CHATBOT_SETUP.md) | Deployment guide and secret management documentation. |

## Scrap photo scanner

The booking materials step includes an optional photo-based material suggestion tool. It requires the same `OPENAI_API_KEY` Edge Function secret used by `chat-support`. Deploy it separately after linking the Supabase project:

```bash
npx supabase functions deploy scrap-scan
```

The function keeps JWT verification enabled, accepts authenticated requests only, limits photo size and per-user requests, and returns suggested catalogue material IDs only. It does not estimate weight or payout and does not store uploaded photos. Customers should confirm suggestions and enter quantities; final weighing and payout remain with the dealer.
