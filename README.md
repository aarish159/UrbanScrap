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
   Open [http://localhost:5173/](http://localhost:5173/) in your browser.

3. **Production build**:
   ```bash
   npm run build
   ```
