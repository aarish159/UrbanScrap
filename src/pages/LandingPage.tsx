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
import { useScrollAnimation } from '../utils/useScrollAnimation';
import { useAuth } from '../contexts/AuthContext';

export const LandingPage: React.FC = () => {
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const { user, openAuthModal } = useAuth();
  useScrollAnimation();

  const handleBookPickupClick = (e: React.MouseEvent) => {
    if (!user) {
      e.preventDefault();
      openAuthModal({
        initialRole: 'customer',
        returnTo: '/book',
        reasonMessage: 'Please sign in or create an account to schedule your doorstep pickup.',
      });
    }
  };

  const toggleFaq = (idx: number) => {
    setOpenFaq(openFaq === idx ? null : idx);
  };

  return (
    <div className="space-y-20 pb-20 overflow-hidden">
      {/* 1. HERO SECTION */}
      <section className="relative overflow-hidden bg-gradient-to-b from-[#eaf8ef]/80 via-[#fbfbf9] to-[#fbfbf9] pt-12 pb-20 border-b border-[#e6e8e5]">
        {/* Soft decorative ambient glow circles */}
        <div
          className="absolute top-0 right-0 -mr-28 -mt-28 w-[32rem] h-[32rem] rounded-full bg-[#dcfce7]/70 blur-3xl pointer-events-none"
          aria-hidden="true"
        />
        <div
          className="absolute bottom-0 left-0 -ml-28 -mb-28 w-[28rem] h-[28rem] rounded-full bg-[#fef3c7]/60 blur-3xl pointer-events-none"
          aria-hidden="true"
        />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
            {/* Left Content */}
            <div className="lg:col-span-7 space-y-6">
              {/* Badge */}
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#eaf8ef] border border-[#bbf7d0] text-xs font-bold text-[#123b26] shadow-xs">
                <Sparkles className="w-4 h-4 text-[#16a34a] shrink-0" />
                <span>Modern doorstep kabadiwala booking platform</span>
              </div>

              {/* Main Heading */}
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-[#123b26] tracking-tight leading-[1.12]">
                Scrap pickup, <br />
                <span className="text-[#16a34a] underline decoration-[#86efac]/80 decoration-wavy decoration-2">
                  made simple & fair.
                </span>
              </h1>

              {/* Supporting Subheading */}
              <p className="text-base sm:text-lg lg:text-xl text-[#3f4541] leading-relaxed max-w-2xl font-normal">
                Check upfront indicative scrap rates, schedule convenient doorstep pickups, and connect with certified local scrap collection partners in India. Transparent digital scale weighing and instant payout.
              </p>

              {/* Main CTAs */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3.5 pt-2">
                <Link
                  to="/book"
                  onClick={handleBookPickupClick}
                  className="inline-flex items-center justify-center gap-2.5 px-8 py-4 rounded-xl text-base font-bold bg-gradient-to-r from-[#16a34a] to-[#15803d] hover:from-[#15803d] hover:to-[#123b26] text-white shadow-lg shadow-[#16a34a]/25 hover:shadow-xl active:scale-[0.98] transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#16a34a]"
                >
                  <Truck className="w-5 h-5 stroke-[2.4]" />
                  <span>Book a pickup</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>

                <Link
                  to="/prices"
                  className="inline-flex items-center justify-center gap-2 px-6 py-4 rounded-xl text-base font-bold bg-white text-[#123b26] border border-[#d1d5db] hover:border-[#123b26] hover:bg-[#f1f3f1] active:scale-[0.98] transition-all duration-150 shadow-xs"
                >
                  <Tag className="w-5 h-5 text-[#16a34a] stroke-[2.2]" />
                  <span>Check scrap prices</span>
                </Link>
              </div>

              {/* Trust badges row */}
              <div className="pt-4 flex flex-wrap items-center gap-y-2 gap-x-6 text-xs text-[#525955] font-semibold">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#16a34a] shrink-0" />
                  <span>Certified Digital Scales</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#16a34a] shrink-0" />
                  <span>Instant UPI / Cash Payout</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#16a34a] shrink-0" />
                  <span>100% Circular Recycling</span>
                </div>
              </div>
            </div>

            {/* Right: Pickup Journey Experience Visual Card */}
            <div className="lg:col-span-5">
              <div className="relative mx-auto max-w-md bg-white rounded-3xl p-6 sm:p-7 shadow-xl shadow-stone-900/5 border border-[#e6e8e5] transition-all hover:shadow-2xl">
                {/* Header card badge */}
                <div className="flex items-center justify-between pb-4 border-b border-[#f1f3f1]">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#123b26] text-[#4ade80] flex items-center justify-center shadow-sm">
                      <Truck className="w-5 h-5 stroke-[2.2]" />
                    </div>
                    <div>
                      <h2 className="font-extrabold text-sm text-[#123b26]">Smart Pickup Journey</h2>
                      <p className="text-[11px] text-[#717a75]">Transparent 4-step doorstep flow</p>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 text-[11px] font-bold rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                    Live Demo
                  </span>
                </div>

                {/* 4 Process Milestone Cards */}
                <div className="mt-5 space-y-3">
                  {/* Step 1 */}
                  <div className="flex items-start gap-3 p-3 rounded-xl bg-[#fbfbf9] border border-[#e8ebe8] hover:border-[#bbf7d0] transition-colors">
                    <div className="w-7 h-7 rounded-lg bg-[#eaf8ef] text-[#16a34a] font-black text-xs flex items-center justify-center shrink-0">
                      1
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="font-bold text-xs text-[#123b26]">Material Selection</p>
                        <span className="text-[10px] text-[#16a34a] font-bold">Paper, Plastic, Metal</span>
                      </div>
                      <p className="text-[11px] text-[#555c58] mt-0.5 leading-snug">
                        Add estimated quantities and instantly preview indicative INR payout.
                      </p>
                    </div>
                  </div>

                  {/* Step 2 */}
                  <div className="flex items-start gap-3 p-3 rounded-xl bg-[#fbfbf9] border border-[#e8ebe8] hover:border-[#bbf7d0] transition-colors">
                    <div className="w-7 h-7 rounded-lg bg-[#eaf8ef] text-[#16a34a] font-black text-xs flex items-center justify-center shrink-0">
                      2
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="font-bold text-xs text-[#123b26]">Doorstep Slot & Address</p>
                        <span className="text-[10px] text-amber-900 bg-amber-100 px-1.5 py-0.5 rounded font-bold">
                          Morning / Evening
                        </span>
                      </div>
                      <p className="text-[11px] text-[#555c58] mt-0.5 leading-snug">
                        Choose your preferred date and time without waiting all day.
                      </p>
                    </div>
                  </div>

                  {/* Step 3 */}
                  <div className="flex items-start gap-3 p-3 rounded-xl bg-[#fbfbf9] border border-[#e8ebe8] hover:border-[#bbf7d0] transition-colors">
                    <div className="w-7 h-7 rounded-lg bg-[#eaf8ef] text-[#16a34a] font-black text-xs flex items-center justify-center shrink-0">
                      3
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="font-bold text-xs text-[#123b26]">Digital Scale Weighing</p>
                        <Scale className="w-3.5 h-3.5 text-[#16a34a]" />
                      </div>
                      <p className="text-[11px] text-[#555c58] mt-0.5 leading-snug">
                        Partner inspects and weighs in front of you with certified scale.
                      </p>
                    </div>
                  </div>

                  {/* Step 4 */}
                  <div className="flex items-start gap-3 p-3 rounded-xl bg-gradient-to-r from-[#eaf8ef] to-[#f0fdf4] border border-[#bbf7d0]">
                    <div className="w-7 h-7 rounded-lg bg-[#16a34a] text-white font-black text-xs flex items-center justify-center shrink-0">
                      4
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="font-bold text-xs text-[#123b26]">Instant Settlement</p>
                        <span className="text-xs font-black text-[#16a34a]">₹ On The Spot</span>
                      </div>
                      <p className="text-[11px] text-[#282c2a] mt-0.5 leading-snug">
                        Direct instant payout via UPI (GPay/PhonePe) or cash receipt.
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
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 reveal-on-scroll">
        <div className="text-center max-w-3xl mx-auto mb-12">
          <span className="text-xs font-bold uppercase tracking-wider text-[#16a34a]">
            Why Urban Scrap
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-[#123b26] mt-2">
            Built for trust, convenience & fair value
          </h2>
          <p className="text-sm sm:text-base text-[#525955] mt-2">
            Eliminate unpredictable hawkers and inaccurate manual spring balances with digital precision.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
          {/* Benefit 1 */}
          <div className="bg-white rounded-2xl p-7 border border-[#e6e8e5] shadow-xs hover:shadow-md transition-all duration-200 hover:-translate-y-0.5 flex flex-col justify-between">
            <div>
              <div className="w-12 h-12 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 flex items-center justify-center mb-5">
                <IndianRupee className="w-6 h-6 stroke-[2.3]" />
              </div>
              <h3 className="text-xl font-bold text-[#123b26] mb-2">Upfront Indicative Rates</h3>
              <p className="text-sm text-[#525955] leading-relaxed">
                Clear per-kg and per-piece market benchmarks for paper, plastic, metals, and electronics so you know roughly what to expect before booking.
              </p>
            </div>
            <div className="mt-5 pt-4 border-t border-[#f1f3f1] flex items-center text-xs font-bold text-[#16a34a]">
              <span>Sample benchmarks updated daily</span>
            </div>
          </div>

          {/* Benefit 2 */}
          <div className="bg-white rounded-2xl p-7 border border-[#e6e8e5] shadow-xs hover:shadow-md transition-all duration-200 hover:-translate-y-0.5 flex flex-col justify-between stagger-1">
            <div>
              <div className="w-12 h-12 rounded-xl bg-emerald-50 border border-emerald-200 text-[#16a34a] flex items-center justify-center mb-5">
                <Calendar className="w-6 h-6 stroke-[2.3]" />
              </div>
              <h3 className="text-xl font-bold text-[#123b26] mb-2">Scheduled Pickup Slots</h3>
              <p className="text-sm text-[#525955] leading-relaxed">
                Choose your convenient date and time window. Tailored for working professionals, weekend decluttering, and gated apartment society drives.
              </p>
            </div>
            <div className="mt-5 pt-4 border-t border-[#f1f3f1] flex items-center text-xs font-bold text-[#16a34a]">
              <span>Morning & afternoon slots</span>
            </div>
          </div>

          {/* Benefit 3 */}
          <div className="bg-white rounded-2xl p-7 border border-[#e6e8e5] shadow-xs hover:shadow-md transition-all duration-200 hover:-translate-y-0.5 flex flex-col justify-between stagger-2">
            <div>
              <div className="w-12 h-12 rounded-xl bg-sky-50 border border-sky-200 text-sky-800 flex items-center justify-center mb-5">
                <UserCheck className="w-6 h-6 stroke-[2.3]" />
              </div>
              <h3 className="text-xl font-bold text-[#123b26] mb-2">Partner Details & Live Status</h3>
              <p className="text-sm text-[#525955] leading-relaxed">
                Receive your assigned dealer’s contact and vehicle details. Monitor your booking from Requested through to Completed weighing in My Bookings.
              </p>
            </div>
            <div className="mt-5 pt-4 border-t border-[#f1f3f1] flex items-center text-xs font-bold text-[#16a34a]">
              <span>Track progress in real-time</span>
            </div>
          </div>
        </div>
      </section>

      {/* 3. HOW IT WORKS SECTION (4 sequenced steps) */}
      <section className="bg-[#f5f7f5] py-16 border-y border-[#e6e8e5] reveal-on-scroll">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <span className="text-xs font-bold uppercase tracking-wider text-[#16a34a]">
              Simple 4-Step Process
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-[#123b26] mt-2">
              How Urban Scrap Works
            </h2>
            <p className="text-sm sm:text-base text-[#525955] mt-2">
              From unused household clutter to cash in your bank account in 4 transparent milestones.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Step 1 */}
            <div className="relative bg-white rounded-2xl p-6 border border-[#e2e4e1] shadow-xs hover:shadow-md transition-all flex flex-col justify-between">
              <div>
                <span className="inline-block text-2xl font-black text-[#16a34a] mb-2">01</span>
                <h3 className="text-lg font-bold text-[#123b26] mb-2">
                  Browse Rate Directory
                </h3>
                <p className="text-xs text-[#525955] leading-relaxed">
                  Inspect indicative sample rates for newspapers, cardboard, iron, copper wire, and defunct e-waste.
                </p>
              </div>
              <div className="mt-5 pt-3 border-t border-[#f1f3f1] text-[11px] font-bold text-[#16a34a]">
                Step 1: Check rates
              </div>
            </div>

            {/* Step 2 */}
            <div className="relative bg-white rounded-2xl p-6 border border-[#e2e4e1] shadow-xs hover:shadow-md transition-all flex flex-col justify-between stagger-1">
              <div>
                <span className="inline-block text-2xl font-black text-[#16a34a] mb-2">02</span>
                <h3 className="text-lg font-bold text-[#123b26] mb-2">
                  Add Scrap & Quantity
                </h3>
                <p className="text-xs text-[#525955] leading-relaxed">
                  Select your items and enter approximate weights to calculate an estimated total payout.
                </p>
              </div>
              <div className="mt-5 pt-3 border-t border-[#f1f3f1] text-[11px] font-bold text-[#16a34a]">
                Step 2: Add to pickup
              </div>
            </div>

            {/* Step 3 */}
            <div className="relative bg-white rounded-2xl p-6 border border-[#e2e4e1] shadow-xs hover:shadow-md transition-all flex flex-col justify-between stagger-2">
              <div>
                <span className="inline-block text-2xl font-black text-[#16a34a] mb-2">03</span>
                <h3 className="text-lg font-bold text-[#123b26] mb-2">
                  Pick Slot & Address
                </h3>
                <p className="text-xs text-[#525955] leading-relaxed">
                  Provide your doorstep address, PIN code, and preferred time window (morning, afternoon, or evening).
                </p>
              </div>
              <div className="mt-5 pt-3 border-t border-[#f1f3f1] text-[11px] font-bold text-[#16a34a]">
                Step 3: Schedule slot
              </div>
            </div>

            {/* Step 4 */}
            <div className="relative bg-white rounded-2xl p-6 border border-[#e2e4e1] shadow-xs hover:shadow-md transition-all flex flex-col justify-between stagger-3">
              <div>
                <span className="inline-block text-2xl font-black text-[#16a34a] mb-2">04</span>
                <h3 className="text-lg font-bold text-[#123b26] mb-2">
                  Weighing & Payment
                </h3>
                <p className="text-xs text-[#525955] leading-relaxed">
                  Assigned partner visits with a certified digital scale, records exact weights, and pays on the spot.
                </p>
              </div>
              <div className="mt-5 pt-3 border-t border-[#f1f3f1] text-[11px] font-bold text-[#16a34a]">
                Step 4: Doorstep settlement
              </div>
            </div>
          </div>

          <div className="mt-10 text-center">
            <Link
              to="/book"
              onClick={handleBookPickupClick}
              className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl font-bold text-sm bg-[#123b26] hover:bg-[#1a5336] text-white shadow-md transition-all"
            >
              <span>Start Booking Now</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* 4. FEATURED MATERIALS SECTION (Paper, Plastic, Metal, E-waste) */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 reveal-on-scroll">
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-10 gap-4">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-[#16a34a]">
              Recyclable Catalogue
            </span>
            <h2 className="text-3xl font-extrabold text-[#123b26] mt-2">
              Common Scrap Materials We Accept
            </h2>
            <p className="text-sm text-[#525955] mt-1">
              Indicative sample rates per kilogram or unit. Final value confirmed via doorstep scale.
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
            className="group block bg-white rounded-2xl p-6 border border-[#e6e8e5] hover:border-[#16a34a] hover:shadow-lg transition-all duration-200"
          >
            <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-800 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <Package className="w-6 h-6 stroke-[2.2]" />
            </div>
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-lg text-[#123b26] group-hover:text-[#16a34a] transition-colors">
                Paper & Cardboard
              </h3>
            </div>
            <p className="text-xs text-[#525955] mt-1 line-clamp-2">
              Daily newspapers (raddi), corrugated boxes, office stationery, and school books.
            </p>
            <div className="mt-4 pt-4 border-t border-[#f1f3f1] flex items-center justify-between">
              <div>
                <span className="text-[11px] text-[#717a75]">Sample benchmark</span>
                <p className="font-extrabold text-sm text-[#123b26]">₹11 - ₹16 / kg</p>
              </div>
              <span className="text-xs font-bold text-[#16a34a] group-hover:translate-x-1 transition-transform inline-flex items-center">
                Explore &rarr;
              </span>
            </div>
          </Link>

          {/* Card 2: Plastic */}
          <Link
            to="/prices?category=plastic"
            className="group block bg-white rounded-2xl p-6 border border-[#e6e8e5] hover:border-[#16a34a] hover:shadow-lg transition-all duration-200 stagger-1"
          >
            <div className="w-12 h-12 rounded-xl bg-sky-50 text-sky-800 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <Layers className="w-6 h-6 stroke-[2.2]" />
            </div>
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-lg text-[#123b26] group-hover:text-[#16a34a] transition-colors">
                Plastic
              </h3>
            </div>
            <p className="text-xs text-[#525955] mt-1 line-clamp-2">
              Crushed clear PET water bottles, hard plastic buckets, chairs, milk packets, containers.
            </p>
            <div className="mt-4 pt-4 border-t border-[#f1f3f1] flex items-center justify-between">
              <div>
                <span className="text-[11px] text-[#717a75]">Sample benchmark</span>
                <p className="font-extrabold text-sm text-[#123b26]">₹9 - ₹18 / kg</p>
              </div>
              <span className="text-xs font-bold text-[#16a34a] group-hover:translate-x-1 transition-transform inline-flex items-center">
                Explore &rarr;
              </span>
            </div>
          </Link>

          {/* Card 3: Metal */}
          <Link
            to="/prices?category=metal"
            className="group block bg-white rounded-2xl p-6 border border-[#e6e8e5] hover:border-[#16a34a] hover:shadow-lg transition-all duration-200 stagger-2"
          >
            <div className="w-12 h-12 rounded-xl bg-slate-100 text-slate-800 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <Scale className="w-6 h-6 stroke-[2.2]" />
            </div>
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-lg text-[#123b26] group-hover:text-[#16a34a] transition-colors">
                Metal
              </h3>
            </div>
            <p className="text-xs text-[#525955] mt-1 line-clamp-2">
              Iron pipes, grilles, aluminium utensils, copper electrical wire, brass idols & taps.
            </p>
            <div className="mt-4 pt-4 border-t border-[#f1f3f1] flex items-center justify-between">
              <div>
                <span className="text-[11px] text-[#717a75]">Sample benchmark</span>
                <p className="font-extrabold text-sm text-[#123b26]">₹28 - ₹420 / kg</p>
              </div>
              <span className="text-xs font-bold text-[#16a34a] group-hover:translate-x-1 transition-transform inline-flex items-center">
                Explore &rarr;
              </span>
            </div>
          </Link>

          {/* Card 4: E-Waste */}
          <Link
            to="/prices?category=ewaste"
            className="group block bg-white rounded-2xl p-6 border border-[#e6e8e5] hover:border-[#16a34a] hover:shadow-lg transition-all duration-200 stagger-3"
          >
            <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-800 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <Cpu className="w-6 h-6 stroke-[2.2]" />
            </div>
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-lg text-[#123b26] group-hover:text-[#16a34a] transition-colors">
                E-Waste
              </h3>
            </div>
            <p className="text-xs text-[#525955] mt-1 line-clamp-2">
              Old chargers, computer peripherals, defunct laptops, CPU cabinets, lead batteries.
            </p>
            <div className="mt-4 pt-4 border-t border-[#f1f3f1] flex items-center justify-between">
              <div>
                <span className="text-[11px] text-[#717a75]">Sample benchmark</span>
                <p className="font-extrabold text-sm text-[#123b26]">₹35 - ₹250 / unit</p>
              </div>
              <span className="text-xs font-bold text-[#16a34a] group-hover:translate-x-1 transition-transform inline-flex items-center">
                Explore &rarr;
              </span>
            </div>
          </Link>
        </div>
      </section>

      {/* 5. FOR DEALERS SECTION */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 reveal-on-scroll">
        <div className="bg-gradient-to-br from-[#123b26] to-[#0a2417] rounded-3xl p-8 sm:p-12 text-white relative overflow-hidden shadow-xl">
          <div
            className="absolute right-0 top-0 -mr-16 -mt-16 w-80 h-80 rounded-full bg-[#16a34a]/20 blur-2xl pointer-events-none"
            aria-hidden="true"
          />

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center relative z-10">
            <div className="lg:col-span-8 space-y-4">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#1e5838] text-xs font-bold text-[#86efac]">
                <Store className="w-4 h-4 shrink-0" />
                <span>Local Scrap Dealers & Recyclers Network</span>
              </div>
              <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
                Are you a local scrap merchant or recycling aggregator?
              </h2>
              <p className="text-[#cad5ce] text-sm sm:text-base leading-relaxed max-w-2xl">
                Urban Scrap connects verified scrap collection partners with scheduled doorstep pickup requests in their neighborhood. Minimize fuel spent on idle roaming, organize daily routes, and grow your recycling turnover.
              </p>
              <div className="pt-2 flex flex-wrap gap-4 text-xs text-[#a7b5ad] font-medium">
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-[#4ade80] shrink-0" />
                  <span>Ward-wise Direct Requests</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-[#4ade80] shrink-0" />
                  <span>Transparent Material Manifest</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-[#4ade80] shrink-0" />
                  <span>Zero Intermediary Commissions</span>
                </div>
              </div>
            </div>

            <div className="lg:col-span-4 flex flex-col items-start lg:items-end justify-center">
              <div className="bg-[#17482f]/80 backdrop-blur-xs p-6 rounded-2xl border border-[#236843] w-full max-w-sm shadow-md">
                <h3 className="font-bold text-white text-base mb-1">Explore Dealer Workflow</h3>
                <p className="text-xs text-[#cad5ce] mb-4">
                  Simulate how scrap merchants view customer leads, update pickup progress, and track daily volume.
                </p>
                <Link
                  to="/dealer"
                  className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-bold text-sm bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 text-stone-950 shadow-md transition-all active:scale-[0.98]"
                >
                  <Store className="w-4 h-4 text-stone-900 shrink-0" />
                  <span>Open Dealer Demo Portal</span>
                </Link>
                <p className="text-[10px] text-amber-200/80 text-center mt-2.5">
                  No login required • Interactive prototype
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 6. FAQ SECTION (working expand/collapse) */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 reveal-on-scroll">
        <div className="text-center mb-10">
          <span className="text-xs font-bold uppercase tracking-wider text-[#16a34a]">
            Got Questions?
          </span>
          <h2 className="text-3xl font-extrabold text-[#123b26] mt-2">
            Frequently Asked Questions
          </h2>
          <p className="text-sm text-[#525955] mt-2">
            Everything you need to know about indicative scrap rates, digital scale weighing, and pickups.
          </p>
        </div>

        <div className="space-y-3">
          {FAQS.map((faq, idx) => {
            const isOpen = openFaq === idx;
            return (
              <div
                key={idx}
                className="bg-white rounded-2xl border border-[#e6e8e5] overflow-hidden transition-all shadow-xs"
              >
                <button
                  type="button"
                  onClick={() => toggleFaq(idx)}
                  className="w-full px-6 py-4.5 text-left flex items-center justify-between gap-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#16a34a]"
                  aria-expanded={isOpen}
                >
                  <span className="font-bold text-sm sm:text-base text-[#123b26]">
                    {faq.q}
                  </span>
                  <div
                    className={`w-7 h-7 rounded-full bg-[#f1f3f1] flex items-center justify-center shrink-0 transition-transform duration-200 ${
                      isOpen ? 'rotate-180 bg-[#eaf8ef] text-[#16a34a]' : 'text-[#717a75]'
                    }`}
                  >
                    <ChevronDown className="w-4 h-4" />
                  </div>
                </button>
                {isOpen && (
                  <div className="px-6 pb-5 pt-1 text-sm text-[#525955] leading-relaxed border-t border-[#f8faf9] animate-in fade-in-50 duration-150">
                    {faq.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* 7. PRE-FOOTER CTA BANNER */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 reveal-on-scroll">
        <div className="bg-[#eaf8ef] border border-[#bbf7d0] rounded-3xl p-8 sm:p-12 text-center relative overflow-hidden shadow-xs">
          <div className="max-w-2xl mx-auto space-y-4">
            <h3 className="text-2xl sm:text-3xl font-extrabold text-[#123b26]">
              Ready to declutter and recycle today?
            </h3>
            <p className="text-sm sm:text-base text-[#3f4541]">
              Schedule your doorstep scrap pickup in under 2 minutes. Transparent rates, verified partners, zero hassle.
            </p>
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3.5">
              <Link
                to="/book"
                onClick={handleBookPickupClick}
                className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl font-bold text-base bg-[#16a34a] hover:bg-[#15803d] text-white shadow-md shadow-[#16a34a]/20 active:scale-[0.98] transition-all"
              >
                <Truck className="w-5 h-5 shrink-0" />
                <span>Book Doorstep Pickup</span>
              </Link>
              <Link
                to="/prices"
                className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl font-bold text-base bg-white text-[#123b26] border border-[#d1d5db] hover:bg-[#f1f3f1] active:scale-[0.98] transition-all"
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
