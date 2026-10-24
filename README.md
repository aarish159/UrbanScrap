# Urban Scrap ♻️

A modern, transparent doorstep scrap pickup platform for households, housing societies, businesses, and certified scrap dealers in India.

## Features & Improvements
- **Indicative Price Directory**: Browse benchmark rates for Paper, Plastic, Metal, and E-Waste with real-time search, category filters, and clear sample rate disclaimers.
- **Smart Doorstep Booking Flow**:
  - Interactive 3-step wizard with visual distinction between current, completed, and pending steps.
  - Starts with an empty scrap manifest with quick-add chips for popular items.
  - Stepper controls (`+` / `-`) for intuitive quantity adjustments.
  - Upfront estimated payout calculations with electronic weighing notices.
  - Review screen with assigned demo dealer partner preview.
- **My Bookings Dashboard**:
  - Real-time status badges (`Requested`, `Dealer Assigned`, `In Progress`, `Completed`, `Cancelled`).
  - Detailed inspection modal with order manifest, partner details, and complete activity timeline.
  - Safe cancellation workflow.
- **Dealer Operations Portal**:
  - Interactive mock operations dashboard for scrap collectors.
  - Summary metrics: New Requests, Scheduled Pickups, Completed Pickups, and Volume Value.
  - Status progression controls (Accept, Start Route, Complete) synced in real-time to customer bookings.
- **Visual Design & Accessibility**:
  - Refined palette: Deep forest green (`#123b26`), vibrant leaf green (`#16a34a`), warm off-white surfaces (`#fbfbf9`), dark charcoal text, and restrained amber notices.
  - Lightweight scroll fade-up animations respecting `prefers-reduced-motion`.
  - Fully responsive across desktop, tablet, and mobile viewports.
  - SPA routing fallback configured for Render static deployment (`public/_redirects` and `render.yaml`).

## Running Locally

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Start development server**:
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000/](http://localhost:3000/) in your browser.

3. **Production build**:
   ```bash
   npm run build
   ```

## Supabase Authentication URL Configuration

To ensure OAuth logins (Google) and password recovery email links work seamlessly in both local development and production on Render, configure your Supabase project as follows:

In **Supabase Dashboard** -> **Authentication** -> **URL Configuration**:

1. **Site URL**:
   ```text
   https://urbanscrap.onrender.com
   ```
   *(For isolated local testing, you can temporarily set Site URL to `http://localhost:3000`)*

2. **Redirect URLs** (Add all of the following to the allowlist):
   ```text
   https://urbanscrap.onrender.com/reset-password
   https://urbanscrap.onrender.com/auth/callback
   https://urbanscrap.onrender.com/**
   http://localhost:3000/reset-password
   http://localhost:3000/auth/callback
   http://localhost:3000/**
   http://localhost:5173/reset-password
   http://localhost:5173/auth/callback
   ```

3. **Email Templates** (Optional / Recommended):
   Under **Authentication** -> **Email Templates** -> **Reset Password**, ensure the action URL uses:
   ```html
   {{ .ConfirmationURL }}
   ```
   Urban Scrap dynamically sends `redirectTo: <app-url>/reset-password` when requesting password resets.

## Testing Password Reset Flow

### Locally
1. Start the dev server: `npm run dev` at `http://localhost:3000`.
2. Click **Login / Sign Up** -> select **Continue as Customer** (or Dealer).
3. Click **Forgot password?** and enter your registered email address.
4. Open the email received from Supabase and click the reset link.
5. The link opens `http://localhost:3000/reset-password` with the verified recovery session.
6. Enter a new password (min. 8 characters) and confirm it.
7. Click **Reset & Update Password**.
8. You will see the confirmation screen and can click **Proceed to Sign In** with your new password.

### On Production (Render)
1. Navigate to `https://urbanscrap.onrender.com`.
2. Open the login modal, click **Forgot password?**, and enter your registered email.
3. In the email, click the link to open `https://urbanscrap.onrender.com/reset-password`.
4. Enter and confirm your new password to complete the reset.

