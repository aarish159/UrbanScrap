import React from 'react';
import { Link } from 'react-router-dom';
import { Recycle, ShieldAlert, Scale, Leaf, ArrowRight } from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer className="bg-[#143e29] text-[#e2e4e1] pt-14 pb-12 border-t border-[#1a5336]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Top Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10 pb-12 border-b border-[#1f5439]">
          {/* Brand Col */}
          <div className="md:col-span-1 space-y-4">
            <Link to="/" className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#22c55e] flex items-center justify-center text-[#143e29] shadow-md">
                <Recycle className="w-6 h-6 stroke-[2.3]" />
              </div>
              <span className="font-extrabold text-2xl tracking-tight text-white">
                Urban<span className="text-[#4ade80]">Scrap</span>
              </span>
            </Link>
            <p className="text-sm text-[#b2beb7] leading-relaxed">
              India's modern digital scrap pickup platform connecting households, apartment societies, and businesses with verified local scrap collection partners.
            </p>
            <div className="flex items-center gap-2 text-xs text-[#86efac]">
              <Leaf className="w-4 h-4 text-[#4ade80]" />
              <span>Promoting circular economy & zero-landfill cities</span>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="text-sm font-bold uppercase tracking-wider text-white mb-4">
              Quick Links
            </h4>
            <ul className="space-y-2.5 text-sm">
              <li>
                <Link to="/" className="hover:text-white transition-colors">
                  Home & Overview
                </Link>
              </li>
              <li>
                <Link to="/prices" className="hover:text-white transition-colors">
                  Indicative Scrap Rates
                </Link>
              </li>
              <li>
                <Link to="/book" className="hover:text-white transition-colors flex items-center gap-1 text-[#86efac]">
                  <span>Book Doorstep Pickup</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </li>
              <li>
                <Link to="/bookings" className="hover:text-white transition-colors">
                  My Bookings Status
                </Link>
              </li>
              <li>
                <Link to="/dealer" className="hover:text-white transition-colors flex items-center gap-1 text-amber-300">
                  <span>Dealer Demo Portal</span>
                </Link>
              </li>
            </ul>
          </div>

          {/* Scrap Categories */}
          <div>
            <h4 className="text-sm font-bold uppercase tracking-wider text-white mb-4">
              Scrap Categories
            </h4>
            <ul className="space-y-2.5 text-sm">
              <li>
                <Link to="/prices" className="hover:text-white transition-colors">
                  Paper & Corrugated Boxes (Raddi)
                </Link>
              </li>
              <li>
                <Link to="/prices" className="hover:text-white transition-colors">
                  Plastic (PET Bottles, Hard Plastic)
                </Link>
              </li>
              <li>
                <Link to="/prices" className="hover:text-white transition-colors">
                  Metals (Iron, Copper, Brass, Aluminium)
                </Link>
              </li>
              <li>
                <Link to="/prices" className="hover:text-white transition-colors">
                  E-Waste & Defunct Electronics
                </Link>
              </li>
              <li>
                <Link to="/book" className="hover:text-white transition-colors">
                  Bulk Society / Commercial Clearance
                </Link>
              </li>
            </ul>
          </div>

          {/* Operational Presence */}
          <div className="space-y-4">
            <h4 className="text-sm font-bold uppercase tracking-wider text-white mb-2">
              Metro Coverage (Sample)
            </h4>
            <div className="flex flex-wrap gap-1.5 text-xs">
              {['Bengaluru', 'Mumbai', 'Delhi NCR', 'Hyderabad', 'Pune', 'Chennai'].map((city) => (
                <span
                  key={city}
                  className="px-2.5 py-1 rounded-md bg-[#1d4c35] text-[#dcfce7] border border-[#276446]"
                >
                  {city}
                </span>
              ))}
            </div>
            <div className="pt-2">
              <div className="flex items-center gap-2 text-xs text-[#a7b5ad]">
                <Scale className="w-4 h-4 text-[#86efac]" />
                <span>Standard certified digital scale weighing</span>
              </div>
            </div>
          </div>
        </div>

        {/* Notice & Disclaimer required by prompt */}
        <div className="my-8 p-4 rounded-xl bg-[#0f2e1e] border border-[#22573b] text-xs text-[#cad5ce] flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0" />
          <div className="leading-relaxed">
            <span className="font-semibold text-amber-300">Disclaimer & Sample Rates Notice: </span>
            Prices shown are indicative sample values. Final value depends on material quality and on-site weighing. This is a functional frontend prototype demonstrating the scrap booking workflow.
          </div>
        </div>

        {/* Bottom copyright */}
        <div className="flex flex-col sm:flex-row items-center justify-between text-xs text-[#8f9d95] gap-4">
          <p>© {new Date().getFullYear()} Urban Scrap India. All rights reserved.</p>
          <div className="flex items-center gap-6">
            <span>Clean India • Swachh Bharat • Circular Recycling</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
