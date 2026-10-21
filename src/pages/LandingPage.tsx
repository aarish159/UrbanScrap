import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Truck,
  ArrowRight,
  Tag,
  Calendar,
  UserCheck,
  ChevronDown,
  Scale,
  Sparkles,
  Layers,
  Cpu,
  Package,
  CheckCircle2,
  IndianRupee,
  Store,
} from 'lucide-react';
import { FAQS } from '../data/mockData';

export const LandingPage: React.FC = () => {
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const toggleFaq = (idx: number) => {
    setOpenFaq(openFaq === idx ? null : idx);
  };

  return (
    <div className="space-y-20 pb-16">
      {/* 1. HERO SECTION */}
      <section className="relative overflow-hidden bg-gradient-to-b from-[#f0fdf4] via-[#fbfbf9] to-[#fbfbf9] pt-12 pb-20 border-b border-[#e8e8e3]">
        {/* Decorative backdrop shapes */}
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-96 h-96 rounded-full bg-[#dcfce7]/60 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-80 h-80 rounded-full bg-[#fef3c7]/50 blur-3xl pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            {/* Left Content */}
            <div className="lg:col-span-7 space-y-6">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#dcfce7] border border-[#bbf7d0] text-xs font-bold text-[#143e29]">
                <Sparkles className="w-4 h-4 text-[#16a34a]" />
                <span>Zero hassle doorstep kabadiwala booking</span>
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-[#143e29] tracking-tight leading-[1.15]">
                Scrap pickup, <br />
                <span className="text-[#16a34a] underline decoration-[#4ade80]/60 decoration-wavy decoration-2">
                  made simple.
                </span>
              </h1>

              <p className="text-lg sm:text-xl text-[#3f4441] leading-relaxed max-w-2xl font-normal">
                Check upfront indicative rates, schedule convenient doorstep pickups, and connect with verified local scrap collection partners in India. Transparent weighing, instant digital payout.
              </p>

              {/* CTAs */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 pt-2">
                <Link
                  to="/book"
                  className="inline-flex items-center justify-center gap-3 px-7 py-4 rounded-xl text-base font-bold bg-[#16a34a] hover:bg-[#15803d] text-white shadow-lg shadow-[#16a34a]/30 hover:shadow-xl active:scale-[0.98] transition-all"
                >
                  <Truck className="w-5 h-5 stroke-[2.4]" />
                  <span>Book a pickup</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>

                <Link
                  to="/prices"
                  className="inline-flex items-center justify-center gap-2 px-6 py-4 rounded-xl text-base font-bold bg-white text-[#143e29] border border-[#d1d5db] hover:border-[#143e29] hover:bg-[#f1f3f1] transition-all shadow-sm"
                >
                  <Tag className="w-5 h-5 text-[#16a34a]" />
                  <span>Check scrap prices</span>
                </Link>
              </div>

              {/* Trust pill row */}
              <div className="pt-4 flex flex-wrap items-center gap-6 text-xs text-[#555c58]">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#16a34a]" />
                  <span>Certified Digital Scales</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#16a34a]" />
                  <span>Instant UPI / Cash Payout</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#16a34a]" />
                  <span>100% Eco-Recycled</span>
                </div>
              </div>
            </div>

            {/* Right: Visual Recycling & Pickup Journey Illustration (HTML/CSS & Icons) */}
            <div className="lg:col-span-5">
              <div className="relative mx-auto max-w-md bg-white rounded-3xl p-6 sm:p-7 shadow-2xl border border-[#e8e8e3]">
                {/* Header card badge */}
                <div className="flex items-center justify-between pb-4 border-b border-[#f1f3f1]">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-[#143e29] text-[#4ade80] flex items-center justify-center">
                      <Truck className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-[#143e29]">Smart Pickup Journey</h4>
                      <p className="text-[11px] text-[#717a75]">Sample Urban Scrap Experience</p>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 text-[11px] font-bold rounded-full bg-emerald-100 text-emerald-800">
                    4 Easy Milestones
                  </span>
                </div>

                {/* Vertical Process Steps */}
                <div className="mt-5 space-y-4">
                  {/* Step 1 Card */}
                  <div className="flex items-start gap-3.5 p-3 rounded-xl bg-[#f8faf9] border border-[#e2e4e1]">
                    <div className="w-8 h-8 rounded-lg bg-[#dcfce7] text-[#16a34a] font-bold text-sm flex items-center justify-center shrink-0">
                      1
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="font-bold text-xs text-[#143e29]">Catalogue Selection</p>
                        <span className="text-[10px] text-[#16a34a] font-semibold">Paper, Iron, PET</span>
                      </div>
                      <p className="text-[11px] text-[#555c58] mt-0.5">
                        Add estimated quantities and view indicative INR earnings.
                      </p>
                    </div>
                  </div>

                  {/* Step 2 Card */}
                  <div className="flex items-start gap-3.5 p-3 rounded-xl bg-[#f8faf9] border border-[#e2e4e1]">
                    <div className="w-8 h-8 rounded-lg bg-[#dcfce7] text-[#16a34a] font-bold text-sm flex items-center justify-center shrink-0">
                      2
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="font-bold text-xs text-[#143e29]">Pick Time & Doorstep Slot</p>
                        <span className="text-[10px] text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded font-medium">
                          Morning / Evening
                        </span>
                      </div>
                      <p className="text-[11px] text-[#555c58] mt-0.5">
                        Choose your convenience without waiting all day.
                      </p>
                    </div>
                  </div>

                  {/* Step 3 Card */}
                  <div className="flex items-start gap-3.5 p-3 rounded-xl bg-[#f8faf9] border border-[#e2e4e1]">
                    <div className="w-8 h-8 rounded-lg bg-[#dcfce7] text-[#16a34a] font-bold text-sm flex items-center justify-center shrink-0">
                      3
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="font-bold text-xs text-[#143e29]">Transparent Electronic Weighing</p>
                        <Scale className="w-3.5 h-3.5 text-[#16a34a]" />
                      </div>
                      <p className="text-[11px] text-[#555c58] mt-0.5">
                        Partner weighs in front of you with certified scale.
                      </p>
                    </div>
                  </div>

                  {/* Step 4 Card */}
                  <div className="flex items-start gap-3.5 p-3 rounded-xl bg-gradient-to-r from-[#eef9f2] to-[#f0fdf4] border border-[#bbf7d0]">
                    <div className="w-8 h-8 rounded-lg bg-[#16a34a] text-white font-bold text-sm flex items-center justify-center shrink-0">
                      4
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="font-bold text-xs text-[#143e29]">Instant UPI Payout</p>
                        <span className="text-xs font-bold text-[#16a34a]">₹ On The Spot</span>
                      </div>
                      <p className="text-[11px] text-[#282c2a] mt-0.5">
                        Direct to GPay / PhonePe / Paytm or instant cash.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Micro simulated preview ticker */}
                <div className="mt-5 pt-4 border-t border-[#f1f3f1] flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="font-medium text-[#555c58]">Doorstep pickup active</span>
                  </div>
                  <Link
                    to="/prices"
                    className="font-bold text-[#16a34a] hover:underline flex items-center gap-1"
                  >
                    <span>Today's Rates</span>
                    <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. TRUST / VALUE SECTION (3 clear benefits) */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-12">
          <span className="text-xs font-bold uppercase tracking-wider text-[#16a34a]">
            Why Urban Scrap
          </span>
          <h2 className="text-3xl font-extrabold text-[#143e29] mt-2">
            Built for trust, convenience & fair value
          </h2>
          <p className="text-sm sm:text-base text-[#555c58] mt-2">
            No more waiting for irregular street hawkers or haggling over dubious manual spring balances.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Benefit 1 */}
          <div className="bg-white rounded-2xl p-7 border border-[#e8e8e3] shadow-sm hover:shadow-md transition-shadow">
            <div className="w-12 h-12 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 flex items-center justify-center mb-5">
              <IndianRupee className="w-6 h-6 stroke-[2.3]" />
            </div>
            <h3 className="text-xl font-bold text-[#143e29] mb-2">Upfront Indicative Prices</h3>
            <p className="text-sm text-[#555c58] leading-relaxed">
              Transparent per-kg and per-unit sample market benchmarks for paper, plastic, metals, and electronics so you know roughly what to expect before booking.
            </p>
          </div>

          {/* Benefit 2 */}
          <div className="bg-white rounded-2xl p-7 border border-[#e8e8e3] shadow-sm hover:shadow-md transition-shadow">
            <div className="w-12 h-12 rounded-xl bg-emerald-50 border border-emerald-200 text-[#16a34a] flex items-center justify-center mb-5">
              <Calendar className="w-6 h-6 stroke-[2.3]" />
            </div>
            <h3 className="text-xl font-bold text-[#143e29] mb-2">Scheduled Pickup Requests</h3>
            <p className="text-sm text-[#555c58] leading-relaxed">
              Pick your preferred date and time slot. Perfect for working professionals, weekend decluttering, and gated apartment society recycling drives.
            </p>
          </div>

          {/* Benefit 3 */}
          <div className="bg-white rounded-2xl p-7 border border-[#e8e8e3] shadow-sm hover:shadow-md transition-shadow">
            <div className="w-12 h-12 rounded-xl bg-sky-50 border border-sky-200 text-sky-800 flex items-center justify-center mb-5">
              <UserCheck className="w-6 h-6 stroke-[2.3]" />
            </div>
            <h3 className="text-xl font-bold text-[#143e29] mb-2">Dealer Details & Booking Status</h3>
            <p className="text-sm text-[#555c58] leading-relaxed">
              Receive your assigned dealer’s contact, vehicle details, and track your request through Requested, Assigned, In-Progress, to Completed.
            </p>
          </div>
        </div>
      </section>

      {/* 3. HOW IT WORKS SECTION (4 numbered steps) */}
      <section className="bg-[#f5f7f5] py-16 border-y border-[#e8e8e3]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <span className="text-xs font-bold uppercase tracking-wider text-[#16a34a]">
              Simple 4-Step Process
            </span>
            <h2 className="text-3xl font-extrabold text-[#143e29] mt-2">
              How Urban Scrap Works
            </h2>
            <p className="text-sm sm:text-base text-[#555c58] mt-2">
              From dusty raddi in your storeroom to clean money in your bank account in 4 steps.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Step 1 */}
            <div className="relative bg-white rounded-2xl p-6 border border-[#e2e4e1] shadow-sm flex flex-col justify-between">
              <div>
                <span className="inline-block text-2xl font-black text-[#16a34a] mb-3">01</span>
                <h3 className="text-lg font-bold text-[#143e29] mb-2">
                  Check Indicative Rates
                </h3>
                <p className="text-xs text-[#555c58] leading-relaxed">
                  Browse standard rates for newspapers, cardboard boxes, iron, copper wire, and e-waste.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-[#f1f3f1] text-[11px] font-semibold text-[#16a34a]">
                Step 1: Browse rates
              </div>
            </div>

            {/* Step 2 */}
            <div className="relative bg-white rounded-2xl p-6 border border-[#e2e4e1] shadow-sm flex flex-col justify-between">
              <div>
                <span className="inline-block text-2xl font-black text-[#16a34a] mb-3">02</span>
                <h3 className="text-lg font-bold text-[#143e29] mb-2">
                  Choose Scrap & Quantity
                </h3>
                <p className="text-xs text-[#555c58] leading-relaxed">
                  Select your items and key in approximate kg or piece counts to see your estimated payout.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-[#f1f3f1] text-[11px] font-semibold text-[#16a34a]">
                Step 2: Add to booking
              </div>
            </div>

            {/* Step 3 */}
            <div className="relative bg-white rounded-2xl p-6 border border-[#e2e4e1] shadow-sm flex flex-col justify-between">
              <div>
                <span className="inline-block text-2xl font-black text-[#16a34a] mb-3">03</span>
                <h3 className="text-lg font-bold text-[#143e29] mb-2">
                  Select Pickup Time & Address
                </h3>
                <p className="text-xs text-[#555c58] leading-relaxed">
                  Provide your doorstep address, pin code, and preferred time slot (morning, afternoon, or evening).
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-[#f1f3f1] text-[11px] font-semibold text-[#16a34a]">
                Step 3: Schedule slot
              </div>
            </div>

            {/* Step 4 */}
            <div className="relative bg-white rounded-2xl p-6 border border-[#e2e4e1] shadow-sm flex flex-col justify-between">
              <div>
                <span className="inline-block text-2xl font-black text-[#16a34a] mb-3">04</span>
                <h3 className="text-lg font-bold text-[#143e29] mb-2">
                  Review Dealer & Status
                </h3>
                <p className="text-xs text-[#555c58] leading-relaxed">
                  Get assigned a verified local partner, monitor progress in real-time, and get paid upon weighing.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-[#f1f3f1] text-[11px] font-semibold text-[#16a34a]">
                Step 4: Doorstep payout
              </div>
            </div>
          </div>

          <div className="mt-10 text-center">
            <Link
              to="/book"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm bg-[#143e29] text-white hover:bg-[#1a5336] transition-colors"
            >
              <span>Start Booking Now</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* 4. FEATURED MATERIALS SECTION (Paper, Plastic, Metal, E-waste) */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-10 gap-4">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-[#16a34a]">
              Recyclable Catalogue
            </span>
            <h2 className="text-3xl font-extrabold text-[#143e29] mt-2">
              Common Scrap Materials We Accept
            </h2>
            <p className="text-sm text-[#555c58] mt-1">
              Indicative sample rates per kilogram. Final value confirmed via doorstep scale.
            </p>
          </div>
          <Link
            to="/prices"
            className="inline-flex items-center gap-1.5 font-bold text-sm text-[#16a34a] hover:text-[#15803d]"
          >
            <span>View all 13+ material benchmarks</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Card 1: Paper */}
          <Link
            to="/prices?category=paper"
            className="group block bg-white rounded-2xl p-6 border border-[#e8e8e3] hover:border-[#16a34a] hover:shadow-lg transition-all duration-200"
          >
            <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-800 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <Package className="w-6 h-6" />
            </div>
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-lg text-[#143e29] group-hover:text-[#16a34a] transition-colors">
                Paper & Cardboard
              </h3>
            </div>
            <p className="text-xs text-[#555c58] mt-1 line-clamp-2">
              Daily newspapers (raddi), shipping carton boxes, office documents, old school notebooks.
            </p>
            <div className="mt-4 pt-4 border-t border-[#f1f3f1] flex items-center justify-between">
              <div>
                <span className="text-[11px] text-[#717a75]">Sample benchmark</span>
                <p className="font-extrabold text-sm text-[#143e29]">₹11 - ₹16 / kg</p>
              </div>
              <span className="text-xs font-bold text-[#16a34a] group-hover:translate-x-1 transition-transform inline-flex items-center">
                Explore &rarr;
              </span>
            </div>
          </Link>

          {/* Card 2: Plastic */}
          <Link
            to="/prices?category=plastic"
            className="group block bg-white rounded-2xl p-6 border border-[#e8e8e3] hover:border-[#16a34a] hover:shadow-lg transition-all duration-200"
          >
            <div className="w-12 h-12 rounded-xl bg-sky-50 text-sky-800 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <Layers className="w-6 h-6" />
            </div>
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-lg text-[#143e29] group-hover:text-[#16a34a] transition-colors">
                Plastic
              </h3>
            </div>
            <p className="text-xs text-[#555c58] mt-1 line-clamp-2">
              Crushed PET drinking water bottles, buckets, oil cans, milk packets, chairs & containers.
            </p>
            <div className="mt-4 pt-4 border-t border-[#f1f3f1] flex items-center justify-between">
              <div>
                <span className="text-[11px] text-[#717a75]">Sample benchmark</span>
                <p className="font-extrabold text-sm text-[#143e29]">₹9 - ₹18 / kg</p>
              </div>
              <span className="text-xs font-bold text-[#16a34a] group-hover:translate-x-1 transition-transform inline-flex items-center">
                Explore &rarr;
              </span>
            </div>
          </Link>

          {/* Card 3: Metal */}
          <Link
            to="/prices?category=metal"
            className="group block bg-white rounded-2xl p-6 border border-[#e8e8e3] hover:border-[#16a34a] hover:shadow-lg transition-all duration-200"
          >
            <div className="w-12 h-12 rounded-xl bg-slate-100 text-slate-800 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <Scale className="w-6 h-6" />
            </div>
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-lg text-[#143e29] group-hover:text-[#16a34a] transition-colors">
                Metal
              </h3>
            </div>
            <p className="text-xs text-[#555c58] mt-1 line-clamp-2">
              Iron pipes, grilles, aluminium utensils, copper electrical wiring, brass idols & taps.
            </p>
            <div className="mt-4 pt-4 border-t border-[#f1f3f1] flex items-center justify-between">
              <div>
                <span className="text-[11px] text-[#717a75]">Sample benchmark</span>
                <p className="font-extrabold text-sm text-[#143e29]">₹28 - ₹420 / kg</p>
              </div>
              <span className="text-xs font-bold text-[#16a34a] group-hover:translate-x-1 transition-transform inline-flex items-center">
                Explore &rarr;
              </span>
            </div>
          </Link>

          {/* Card 4: E-Waste */}
          <Link
            to="/prices?category=ewaste"
            className="group block bg-white rounded-2xl p-6 border border-[#e8e8e3] hover:border-[#16a34a] hover:shadow-lg transition-all duration-200"
          >
            <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-800 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <Cpu className="w-6 h-6" />
            </div>
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-lg text-[#143e29] group-hover:text-[#16a34a] transition-colors">
                E-Waste
              </h3>
            </div>
            <p className="text-xs text-[#555c58] mt-1 line-clamp-2">
              Old chargers, circuit boards, dead laptops, desktop CPU cabinets, invertor lead batteries.
            </p>
            <div className="mt-4 pt-4 border-t border-[#f1f3f1] flex items-center justify-between">
              <div>
                <span className="text-[11px] text-[#717a75]">Sample benchmark</span>
                <p className="font-extrabold text-sm text-[#143e29]">₹35 - ₹250 / unit</p>
              </div>
              <span className="text-xs font-bold text-[#16a34a] group-hover:translate-x-1 transition-transform inline-flex items-center">
                Explore &rarr;
              </span>
            </div>
          </Link>
        </div>
      </section>

      {/* 5. FOR DEALERS SECTION */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-gradient-to-br from-[#143e29] to-[#0f2e1e] rounded-3xl p-8 sm:p-12 text-white relative overflow-hidden shadow-xl">
          <div className="absolute right-0 top-0 -mr-16 -mt-16 w-80 h-80 rounded-full bg-[#16a34a]/20 blur-2xl pointer-events-none" />

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center relative z-10">
            <div className="lg:col-span-8 space-y-4">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#226f48] text-xs font-bold text-[#86efac]">
                <Store className="w-4 h-4" />
                <span>Local Scrap Dealers & Recyclers Network</span>
              </div>
              <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
                Are you a scrap collection partner or recycling aggregator?
              </h2>
              <p className="text-[#c5cac7] text-sm sm:text-base leading-relaxed max-w-2xl">
                Urban Scrap connects local scrap merchants with verified doorstep pickup requests in their operational ward. Minimize idle street roaming, plan pickup routes efficiently, and grow daily turnover with digital requests.
              </p>
              <div className="pt-2 flex flex-wrap gap-4 text-xs text-[#a7b5ad]">
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-[#4ade80]" />
                  <span>Receive Ward-wise Bookings</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-[#4ade80]" />
                  <span>Transparent Customer Notes</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-[#4ade80]" />
                  <span>Direct Customer Interaction</span>
                </div>
              </div>
            </div>

            <div className="lg:col-span-4 flex flex-col items-start lg:items-end justify-center">
              <div className="bg-[#1a5336]/80 p-6 rounded-2xl border border-[#276446] w-full max-w-sm">
                <h4 className="font-bold text-white text-sm mb-1">Explore Dealer Workflow</h4>
                <p className="text-xs text-[#cad5ce] mb-4">
                  Experience how scrap merchants view leads, update pickup progress, and review daily volume.
                </p>
                <Link
                  to="/dealer"
                  className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-bold text-sm bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 text-stone-950 shadow-md transition-all"
                >
                  <Store className="w-4 h-4 text-stone-900" />
                  <span>Open Dealer Demo Portal</span>
                </Link>
                <p className="text-[10px] text-amber-200/80 text-center mt-2">
                  No login required • Interactive prototype
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 6. FAQ SECTION (working expand/collapse) */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-10">
          <span className="text-xs font-bold uppercase tracking-wider text-[#16a34a]">
            Got Questions?
          </span>
          <h2 className="text-3xl font-extrabold text-[#143e29] mt-2">
            Frequently Asked Questions
          </h2>
          <p className="text-sm text-[#555c58] mt-2">
            Everything you need to know about our sample indicative rates, weighing, and doorstep pickups.
          </p>
        </div>

        <div className="space-y-3">
          {FAQS.map((faq, idx) => {
            const isOpen = openFaq === idx;
            return (
              <div
                key={idx}
                className="bg-white rounded-2xl border border-[#e8e8e3] overflow-hidden transition-all shadow-sm"
              >
                <button
                  type="button"
                  onClick={() => toggleFaq(idx)}
                  className="w-full px-6 py-4.5 text-left flex items-center justify-between gap-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#16a34a]"
                  aria-expanded={isOpen}
                >
                  <span className="font-bold text-sm sm:text-base text-[#143e29]">
                    {faq.q}
                  </span>
                  <div
                    className={`w-7 h-7 rounded-full bg-[#f1f3f1] flex items-center justify-center shrink-0 transition-transform duration-200 ${
                      isOpen ? 'rotate-180 bg-[#dcfce7] text-[#16a34a]' : 'text-[#717a75]'
                    }`}
                  >
                    <ChevronDown className="w-4 h-4" />
                  </div>
                </button>
                {isOpen && (
                  <div className="px-6 pb-5 pt-1 text-sm text-[#555c58] leading-relaxed border-t border-[#f8faf9] animate-in fade-in-50 duration-150">
                    {faq.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* 7. PRE-FOOTER CTA BANNER */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-[#f0fdf4] border border-[#bbf7d0] rounded-3xl p-8 sm:p-12 text-center relative overflow-hidden">
          <div className="max-w-2xl mx-auto space-y-4">
            <h3 className="text-2xl sm:text-3xl font-extrabold text-[#143e29]">
              Ready to declutter and recycle today?
            </h3>
            <p className="text-sm sm:text-base text-[#3f4441]">
              Schedule your doorstep scrap pickup in under 2 minutes. Transparent rates, verified partners, zero hassle.
            </p>
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                to="/book"
                className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl font-bold text-base bg-[#16a34a] hover:bg-[#15803d] text-white shadow-md shadow-[#16a34a]/20"
              >
                <Truck className="w-5 h-5" />
                <span>Book Doorstep Pickup</span>
              </Link>
              <Link
                to="/prices"
                className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl font-bold text-base bg-white text-[#143e29] border border-[#d1d5db] hover:bg-[#f1f3f1]"
              >
                <span>View Rate Card</span>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
