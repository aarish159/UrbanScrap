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
    <div className="space-y-20 pb-20 overflow-hidden text-white">
      {/* 1. HERO SECTION */}
      <section className="relative overflow-hidden pt-12 pb-20 border-b border-white/[0.08]">
        {/* Soft decorative ambient glow circles */}
        <div
          className="absolute top-0 right-0 -mr-28 -mt-28 w-[36rem] h-[36rem] rounded-full bg-emerald-600/15 blur-[120px] pointer-events-none"
          aria-hidden="true"
        />
        <div
          className="absolute bottom-0 left-0 -ml-28 -mb-28 w-[32rem] h-[32rem] rounded-full bg-emerald-950/30 blur-[100px] pointer-events-none"
          aria-hidden="true"
        />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
            {/* Left Content */}
            <div className="lg:col-span-7 space-y-6">
              {/* Badge */}
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/[0.04] border border-white/10 text-xs font-bold text-emerald-300 shadow-sm backdrop-blur-md">
                <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Modern doorstep kabadiwala booking platform</span>
              </div>

              {/* Main Heading */}
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white tracking-tight leading-[1.12]">
                Scrap pickup, <br />
                <span className="text-emerald-400 underline decoration-emerald-500/40 decoration-wavy decoration-2">
                  made simple & fair.
                </span>
              </h1>

              {/* Supporting Subheading */}
              <p className="text-base sm:text-lg lg:text-xl text-emerald-100/70 leading-relaxed max-w-2xl font-normal">
                Check upfront indicative scrap rates, schedule convenient doorstep pickups, and connect with certified local scrap collection partners in India. Transparent digital scale weighing and instant payout.
              </p>

              {/* Main CTAs */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3.5 pt-2">
                <Link
                  to="/book"
                  onClick={handleBookPickupClick}
                  className="inline-flex items-center justify-center gap-2.5 px-8 py-4 rounded-xl text-base font-bold bg-gradient-to-r from-emerald-600 via-emerald-500 to-green-500 hover:from-emerald-500 hover:to-green-400 text-white shadow-xl shadow-emerald-950/60 hover:shadow-emerald-900/80 active:scale-[0.98] transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
                >
                  <Truck className="w-5 h-5 stroke-[2.4]" />
                  <span>Book a pickup</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>

                <Link
                  to="/prices"
                  className="inline-flex items-center justify-center gap-2 px-6 py-4 rounded-xl text-base font-bold bg-white/[0.05] text-white border border-white/10 hover:border-emerald-500/40 hover:bg-white/10 active:scale-[0.98] transition-all duration-150 shadow-sm backdrop-blur-md"
                >
                  <Tag className="w-5 h-5 text-emerald-400 stroke-[2.2]" />
                  <span>Check scrap prices</span>
                </Link>
              </div>

              {/* Trust badges row */}
              <div className="pt-4 flex flex-wrap items-center gap-y-2 gap-x-6 text-xs text-emerald-200/80 font-semibold">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Certified Digital Scales</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Instant UPI / Cash Payout</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>100% Circular Recycling</span>
                </div>
              </div>
            </div>

            {/* Right: Pickup Journey Experience Visual Card */}
            <div className="lg:col-span-5">
              <div className="relative mx-auto max-w-md bg-white/[0.035] backdrop-blur-2xl rounded-3xl p-6 sm:p-7 shadow-2xl shadow-black/70 border border-white/10 transition-all hover:border-emerald-500/30">
                {/* Header card badge */}
                <div className="flex items-center justify-between pb-4 border-b border-white/[0.08]">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 flex items-center justify-center shadow-sm">
                      <Truck className="w-5 h-5 stroke-[2.2]" />
                    </div>
                    <div>
                      <h2 className="font-extrabold text-sm text-white">Smart Pickup Journey</h2>
                      <p className="text-[11px] text-emerald-300/60">Transparent 4-step doorstep flow</p>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 text-[11px] font-bold rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                    Live Demo
                  </span>
                </div>

                {/* 4 Process Milestone Cards */}
                <div className="mt-5 space-y-3">
                  {/* Step 1 */}
                  <div className="flex items-start gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/[0.07] hover:border-emerald-500/30 transition-colors">
                    <div className="w-7 h-7 rounded-lg bg-emerald-500/15 border border-emerald-500/25 text-emerald-300 font-black text-xs flex items-center justify-center shrink-0">
                      1
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="font-bold text-xs text-white">Material Selection</p>
                        <span className="text-[10px] text-emerald-400 font-bold">Paper, Plastic, Metal</span>
                      </div>
                      <p className="text-[11px] text-[#9cb1a4] mt-0.5 leading-snug">
                        Add estimated quantities and instantly preview indicative INR payout.
                      </p>
                    </div>
                  </div>

                  {/* Step 2 */}
                  <div className="flex items-start gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/[0.07] hover:border-emerald-500/30 transition-colors">
                    <div className="w-7 h-7 rounded-lg bg-emerald-500/15 border border-emerald-500/25 text-emerald-300 font-black text-xs flex items-center justify-center shrink-0">
                      2
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="font-bold text-xs text-white">Doorstep Slot & Address</p>
                        <span className="text-[10px] text-amber-300 bg-amber-500/15 border border-amber-500/25 px-1.5 py-0.5 rounded font-bold">
                          Morning / Evening
                        </span>
                      </div>
                      <p className="text-[11px] text-[#9cb1a4] mt-0.5 leading-snug">
                        Choose your preferred date and time without waiting all day.
                      </p>
                    </div>
                  </div>

                  {/* Step 3 */}
                  <div className="flex items-start gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/[0.07] hover:border-emerald-500/30 transition-colors">
                    <div className="w-7 h-7 rounded-lg bg-emerald-500/15 border border-emerald-500/25 text-emerald-300 font-black text-xs flex items-center justify-center shrink-0">
                      3
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="font-bold text-xs text-white">Digital Scale Weighing</p>
                        <Scale className="w-3.5 h-3.5 text-emerald-400" />
                      </div>
                      <p className="text-[11px] text-[#9cb1a4] mt-0.5 leading-snug">
                        Partner inspects and weighs in front of you with certified scale.
                      </p>
                    </div>
                  </div>

                  {/* Step 4 */}
                  <div className="flex items-start gap-3 p-3 rounded-xl bg-gradient-to-r from-emerald-500/15 to-emerald-600/10 border border-emerald-500/30">
                    <div className="w-7 h-7 rounded-lg bg-emerald-500 text-white font-black text-xs flex items-center justify-center shrink-0 shadow-sm shadow-emerald-950/50">
                      4
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="font-bold text-xs text-white">Instant Settlement</p>
                        <span className="text-xs font-black text-emerald-400">₹ On The Spot</span>
                      </div>
                      <p className="text-[11px] text-emerald-200/80 mt-0.5 leading-snug">
                        Direct instant payout via UPI (GPay/PhonePe) or cash receipt.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Micro simulated preview ticker */}
                <div className="mt-5 pt-4 border-t border-white/[0.08] flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shadow-sm shadow-emerald-400/50" />
                    <span className="font-medium text-emerald-200/70">Doorstep pickup active</span>
                  </div>
                  <Link
                    to="/prices"
                    className="font-bold text-emerald-400 hover:text-emerald-300 hover:underline flex items-center gap-1 transition-colors"
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
          <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
            Why Urban Scrap
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white mt-2">
            Built for trust, convenience & fair value
          </h2>
          <p className="text-sm sm:text-base text-emerald-200/70 mt-2">
            Eliminate unpredictable hawkers and inaccurate manual spring balances with digital precision.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
          {/* Benefit 1 */}
          <div className="bg-white/[0.035] backdrop-blur-xl rounded-2xl p-7 border border-white/[0.08] shadow-xl hover:border-emerald-500/35 transition-all duration-200 hover:-translate-y-0.5 flex flex-col justify-between">
            <div>
              <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-300 flex items-center justify-center mb-5">
                <IndianRupee className="w-6 h-6 stroke-[2.3]" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Upfront Indicative Rates</h3>
              <p className="text-sm text-[#9cb1a4] leading-relaxed">
                Clear per-kg and per-piece market benchmarks for paper, plastic, metals, and electronics so you know roughly what to expect before booking.
              </p>
            </div>
            <div className="mt-5 pt-4 border-t border-white/[0.08] flex items-center text-xs font-bold text-emerald-400">
              <span>Sample benchmarks updated daily</span>
            </div>
          </div>

          {/* Benefit 2 */}
          <div className="bg-white/[0.035] backdrop-blur-xl rounded-2xl p-7 border border-white/[0.08] shadow-xl hover:border-emerald-500/35 transition-all duration-200 hover:-translate-y-0.5 flex flex-col justify-between stagger-1">
            <div>
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-300 flex items-center justify-center mb-5">
                <Calendar className="w-6 h-6 stroke-[2.3]" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Scheduled Pickup Slots</h3>
              <p className="text-sm text-[#9cb1a4] leading-relaxed">
                Choose your convenient date and time window. Tailored for working professionals, weekend decluttering, and gated apartment society drives.
              </p>
            </div>
            <div className="mt-5 pt-4 border-t border-white/[0.08] flex items-center text-xs font-bold text-emerald-400">
              <span>Morning & afternoon slots</span>
            </div>
          </div>

          {/* Benefit 3 */}
          <div className="bg-white/[0.035] backdrop-blur-xl rounded-2xl p-7 border border-white/[0.08] shadow-xl hover:border-emerald-500/35 transition-all duration-200 hover:-translate-y-0.5 flex flex-col justify-between stagger-2">
            <div>
              <div className="w-12 h-12 rounded-xl bg-sky-500/10 border border-sky-500/25 text-sky-300 flex items-center justify-center mb-5">
                <UserCheck className="w-6 h-6 stroke-[2.3]" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Partner Details & Live Status</h3>
              <p className="text-sm text-[#9cb1a4] leading-relaxed">
                Receive your assigned dealer’s contact and vehicle details. Monitor your booking from Requested through to Completed weighing in My Bookings.
              </p>
            </div>
            <div className="mt-5 pt-4 border-t border-white/[0.08] flex items-center text-xs font-bold text-emerald-400">
              <span>Track progress in real-time</span>
            </div>
          </div>
        </div>
      </section>

      {/* 3. HOW IT WORKS SECTION (4 sequenced steps) */}
      <section className="bg-white/[0.015] py-16 border-y border-white/[0.08] reveal-on-scroll">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
              Simple 4-Step Process
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white mt-2">
              How Urban Scrap Works
            </h2>
            <p className="text-sm sm:text-base text-emerald-200/70 mt-2">
              From unused household clutter to cash in your bank account in 4 transparent milestones.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Step 1 */}
            <div className="relative bg-white/[0.035] backdrop-blur-md rounded-2xl p-6 border border-white/[0.08] shadow-lg hover:border-emerald-500/35 transition-all flex flex-col justify-between">
              <div>
                <span className="inline-block text-2xl font-black text-emerald-400 mb-2">01</span>
                <h3 className="text-lg font-bold text-white mb-2">
                  Browse Rate Directory
                </h3>
                <p className="text-xs text-[#9cb1a4] leading-relaxed">
                  Inspect indicative sample rates for newspapers, cardboard, iron, copper wire, and defunct e-waste.
                </p>
              </div>
              <div className="mt-5 pt-3 border-t border-white/[0.08] text-[11px] font-bold text-emerald-400">
                Step 1: Check rates
              </div>
            </div>

            {/* Step 2 */}
            <div className="relative bg-white/[0.035] backdrop-blur-md rounded-2xl p-6 border border-white/[0.08] shadow-lg hover:border-emerald-500/35 transition-all flex flex-col justify-between stagger-1">
              <div>
                <span className="inline-block text-2xl font-black text-emerald-400 mb-2">02</span>
                <h3 className="text-lg font-bold text-white mb-2">
                  Add Scrap & Quantity
                </h3>
                <p className="text-xs text-[#9cb1a4] leading-relaxed">
                  Select your items and enter approximate weights to calculate an estimated total payout.
                </p>
              </div>
              <div className="mt-5 pt-3 border-t border-white/[0.08] text-[11px] font-bold text-emerald-400">
                Step 2: Add to pickup
              </div>
            </div>

            {/* Step 3 */}
            <div className="relative bg-white/[0.035] backdrop-blur-md rounded-2xl p-6 border border-white/[0.08] shadow-lg hover:border-emerald-500/35 transition-all flex flex-col justify-between stagger-2">
              <div>
                <span className="inline-block text-2xl font-black text-emerald-400 mb-2">03</span>
                <h3 className="text-lg font-bold text-white mb-2">
                  Pick Slot & Address
                </h3>
                <p className="text-xs text-[#9cb1a4] leading-relaxed">
                  Provide your doorstep address, PIN code, and preferred time window (morning, afternoon, or evening).
                </p>
              </div>
              <div className="mt-5 pt-3 border-t border-white/[0.08] text-[11px] font-bold text-emerald-400">
                Step 3: Schedule slot
              </div>
            </div>

            {/* Step 4 */}
            <div className="relative bg-white/[0.035] backdrop-blur-md rounded-2xl p-6 border border-white/[0.08] shadow-lg hover:border-emerald-500/35 transition-all flex flex-col justify-between stagger-3">
              <div>
                <span className="inline-block text-2xl font-black text-emerald-400 mb-2">04</span>
                <h3 className="text-lg font-bold text-white mb-2">
                  Weighing & Payment
                </h3>
                <p className="text-xs text-[#9cb1a4] leading-relaxed">
                  Assigned partner visits with a certified digital scale, records exact weights, and pays on the spot.
                </p>
              </div>
              <div className="mt-5 pt-3 border-t border-white/[0.08] text-[11px] font-bold text-emerald-400">
                Step 4: Doorstep settlement
              </div>
            </div>
          </div>

          <div className="mt-10 text-center">
            <Link
              to="/book"
              onClick={handleBookPickupClick}
              className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl font-bold text-sm bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white shadow-lg shadow-emerald-950/60 transition-all"
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
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
              Recyclable Catalogue
            </span>
            <h2 className="text-3xl font-extrabold text-white mt-2">
              Common Scrap Materials We Accept
            </h2>
            <p className="text-sm text-emerald-200/70 mt-1">
              Indicative sample rates per kilogram or unit. Final value confirmed via doorstep scale.
            </p>
          </div>
          <Link
            to="/prices"
            className="inline-flex items-center gap-1.5 font-bold text-sm text-emerald-400 hover:text-emerald-300 transition-colors"
          >
            <span>View all 13+ material benchmarks</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Card 1: Paper */}
          <Link
            to="/prices?category=paper"
            className="group block bg-white/[0.035] backdrop-blur-md rounded-2xl p-6 border border-white/[0.08] hover:border-emerald-500/40 hover:bg-white/[0.06] hover:shadow-2xl hover:shadow-emerald-950/40 transition-all duration-200"
          >
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-300 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <Package className="w-6 h-6 stroke-[2.2]" />
            </div>
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-lg text-white group-hover:text-emerald-300 transition-colors">
                Paper & Cardboard
              </h3>
            </div>
            <p className="text-xs text-[#9cb1a4] mt-1 line-clamp-2">
              Daily newspapers (raddi), corrugated boxes, office stationery, and school books.
            </p>
            <div className="mt-4 pt-4 border-t border-white/[0.08] flex items-center justify-between">
              <div>
                <span className="text-[11px] text-emerald-300/60">Sample benchmark</span>
                <p className="font-extrabold text-sm text-white">₹11 - ₹16 / kg</p>
              </div>
              <span className="text-xs font-bold text-emerald-400 group-hover:translate-x-1 transition-transform inline-flex items-center">
                Explore &rarr;
              </span>
            </div>
          </Link>

          {/* Card 2: Plastic */}
          <Link
            to="/prices?category=plastic"
            className="group block bg-white/[0.035] backdrop-blur-md rounded-2xl p-6 border border-white/[0.08] hover:border-emerald-500/40 hover:bg-white/[0.06] hover:shadow-2xl hover:shadow-emerald-950/40 transition-all duration-200 stagger-1"
          >
            <div className="w-12 h-12 rounded-xl bg-sky-500/10 border border-sky-500/25 text-sky-300 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <Layers className="w-6 h-6 stroke-[2.2]" />
            </div>
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-lg text-white group-hover:text-emerald-300 transition-colors">
                Plastic
              </h3>
            </div>
            <p className="text-xs text-[#9cb1a4] mt-1 line-clamp-2">
              Crushed clear PET water bottles, hard plastic buckets, chairs, milk packets, containers.
            </p>
            <div className="mt-4 pt-4 border-t border-white/[0.08] flex items-center justify-between">
              <div>
                <span className="text-[11px] text-emerald-300/60">Sample benchmark</span>
                <p className="font-extrabold text-sm text-white">₹9 - ₹18 / kg</p>
              </div>
              <span className="text-xs font-bold text-emerald-400 group-hover:translate-x-1 transition-transform inline-flex items-center">
                Explore &rarr;
              </span>
            </div>
          </Link>

          {/* Card 3: Metal */}
          <Link
            to="/prices?category=metal"
            className="group block bg-white/[0.035] backdrop-blur-md rounded-2xl p-6 border border-white/[0.08] hover:border-emerald-500/40 hover:bg-white/[0.06] hover:shadow-2xl hover:shadow-emerald-950/40 transition-all duration-200 stagger-2"
          >
            <div className="w-12 h-12 rounded-xl bg-slate-500/15 border border-slate-500/25 text-slate-200 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <Scale className="w-6 h-6 stroke-[2.2]" />
            </div>
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-lg text-white group-hover:text-emerald-300 transition-colors">
                Metal
              </h3>
            </div>
            <p className="text-xs text-[#9cb1a4] mt-1 line-clamp-2">
              Iron pipes, grilles, aluminium utensils, copper electrical wire, brass idols & taps.
            </p>
            <div className="mt-4 pt-4 border-t border-white/[0.08] flex items-center justify-between">
              <div>
                <span className="text-[11px] text-emerald-300/60">Sample benchmark</span>
                <p className="font-extrabold text-sm text-white">₹28 - ₹420 / kg</p>
              </div>
              <span className="text-xs font-bold text-emerald-400 group-hover:translate-x-1 transition-transform inline-flex items-center">
                Explore &rarr;
              </span>
            </div>
          </Link>

          {/* Card 4: E-Waste */}
          <Link
            to="/prices?category=ewaste"
            className="group block bg-white/[0.035] backdrop-blur-md rounded-2xl p-6 border border-white/[0.08] hover:border-emerald-500/40 hover:bg-white/[0.06] hover:shadow-2xl hover:shadow-emerald-950/40 transition-all duration-200 stagger-3"
          >
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-300 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <Cpu className="w-6 h-6 stroke-[2.2]" />
            </div>
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-lg text-white group-hover:text-emerald-300 transition-colors">
                E-Waste
              </h3>
            </div>
            <p className="text-xs text-[#9cb1a4] mt-1 line-clamp-2">
              Old chargers, computer peripherals, defunct laptops, CPU cabinets, lead batteries.
            </p>
            <div className="mt-4 pt-4 border-t border-white/[0.08] flex items-center justify-between">
              <div>
                <span className="text-[11px] text-emerald-300/60">Sample benchmark</span>
                <p className="font-extrabold text-sm text-white">₹35 - ₹250 / unit</p>
              </div>
              <span className="text-xs font-bold text-emerald-400 group-hover:translate-x-1 transition-transform inline-flex items-center">
                Explore &rarr;
              </span>
            </div>
          </Link>
        </div>
      </section>

      {/* 5. FOR DEALERS SECTION */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 reveal-on-scroll">
        <div className="bg-gradient-to-br from-[#0c2417] via-[#091a11] to-[#06120c] rounded-3xl p-8 sm:p-12 text-white relative overflow-hidden shadow-2xl border border-emerald-500/25">
          <div
            className="absolute right-0 top-0 -mr-16 -mt-16 w-80 h-80 rounded-full bg-emerald-500/15 blur-3xl pointer-events-none"
            aria-hidden="true"
          />

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center relative z-10">
            <div className="lg:col-span-8 space-y-4">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/25 text-xs font-bold text-emerald-300">
                <Store className="w-4 h-4 shrink-0" />
                <span>Local Scrap Dealers & Recyclers Network</span>
              </div>
              <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
                Are you a local scrap merchant or recycling aggregator?
              </h2>
              <p className="text-emerald-100/70 text-sm sm:text-base leading-relaxed max-w-2xl">
                Urban Scrap connects verified scrap collection partners with scheduled doorstep pickup requests in their neighborhood. Minimize fuel spent on idle roaming, organize daily routes, and grow your recycling turnover.
              </p>
              <div className="pt-2 flex flex-wrap gap-4 text-xs text-emerald-200/80 font-medium">
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Ward-wise Direct Requests</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Transparent Material Manifest</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Zero Intermediary Commissions</span>
                </div>
              </div>
            </div>

            <div className="lg:col-span-4 flex flex-col items-start lg:items-end justify-center">
              <div className="bg-white/[0.04] backdrop-blur-xl p-6 rounded-2xl border border-white/10 w-full max-w-sm shadow-xl">
                <h3 className="font-bold text-white text-base mb-1">Explore Dealer Workflow</h3>
                <p className="text-xs text-emerald-200/70 mb-4">
                  Simulate how scrap merchants view customer leads, update pickup progress, and track daily volume.
                </p>
                <Link
                  to="/dealer"
                  className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-bold text-sm bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-stone-950 shadow-lg shadow-amber-950/40 transition-all active:scale-[0.98]"
                >
                  <Store className="w-4 h-4 text-stone-900 shrink-0" />
                  <span>Open Dealer Demo Portal</span>
                </Link>
                <p className="text-[10px] text-amber-200/70 text-center mt-2.5">
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
          <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
            Got Questions?
          </span>
          <h2 className="text-3xl font-extrabold text-white mt-2">
            Frequently Asked Questions
          </h2>
          <p className="text-sm text-emerald-200/70 mt-2">
            Everything you need to know about indicative scrap rates, digital scale weighing, and pickups.
          </p>
        </div>

        <div className="space-y-3">
          {FAQS.map((faq, idx) => {
            const isOpen = openFaq === idx;
            return (
              <div
                key={idx}
                className="bg-white/[0.035] backdrop-blur-md rounded-2xl border border-white/[0.08] overflow-hidden transition-all shadow-sm hover:border-white/15"
              >
                <button
                  type="button"
                  onClick={() => toggleFaq(idx)}
                  className="w-full px-6 py-4.5 text-left flex items-center justify-between gap-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
                  aria-expanded={isOpen}
                >
                  <span className="font-bold text-sm sm:text-base text-white">
                    {faq.q}
                  </span>
                  <div
                    className={`w-7 h-7 rounded-full bg-white/[0.05] flex items-center justify-center shrink-0 transition-transform duration-200 ${
                      isOpen ? 'rotate-180 bg-emerald-500/20 text-emerald-400' : 'text-white/60'
                    }`}
                  >
                    <ChevronDown className="w-4 h-4" />
                  </div>
                </button>
                {isOpen && (
                  <div className="px-6 pb-5 pt-1 text-sm text-[#9cb1a4] leading-relaxed border-t border-white/[0.06] animate-in fade-in-50 duration-150">
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
        <div className="bg-gradient-to-br from-[#0b2416]/90 via-[#091a11]/90 to-[#07150e]/95 backdrop-blur-xl border border-emerald-500/25 rounded-3xl p-8 sm:p-12 text-center relative overflow-hidden shadow-2xl text-white">
          <div className="max-w-2xl mx-auto space-y-4">
            <h3 className="text-2xl sm:text-3xl font-extrabold text-white">
              Ready to declutter and recycle today?
            </h3>
            <p className="text-sm sm:text-base text-emerald-100/70">
              Schedule your doorstep scrap pickup in under 2 minutes. Transparent rates, verified partners, zero hassle.
            </p>
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3.5">
              <Link
                to="/book"
                onClick={handleBookPickupClick}
                className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl font-bold text-base bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 text-white shadow-lg shadow-emerald-950/60 active:scale-[0.98] transition-all"
              >
                <Truck className="w-5 h-5 shrink-0" />
                <span>Book Doorstep Pickup</span>
              </Link>
              <Link
                to="/prices"
                className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl font-bold text-base bg-white/[0.05] text-white border border-white/10 hover:bg-white/10 active:scale-[0.98] transition-all"
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
