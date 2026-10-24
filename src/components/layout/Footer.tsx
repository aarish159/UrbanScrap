import React from 'react';
import { Link } from 'react-router-dom';
import { Recycle, ShieldAlert, Scale, Leaf, ArrowRight } from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer className="bg-[#0e2c1c] text-[#d6ded9] pt-14 pb-12 border-t border-[#17482f]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Top Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10 pb-12 border-b border-[#1b5035]">
          {/* Brand Col */}
          <div className="md:col-span-1 space-y-4">
            <Link to="/" className="flex items-center gap-3 inline-flex">
              <div className="w-10 h-10 rounded-xl bg-[#22c55e] flex items-center justify-center text-[#0e2c1c] shadow-md shadow-[#22c55e]/20">
                <Recycle className="w-6 h-6 stroke-[2.3]" />
              </div>
              <span className="font-extrabold text-2xl tracking-tight text-white">
                Urban<span className="text-[#4ade80]">Scrap</span>
              </span>
            </Link>
            <p className="text-sm text-[#b6c2bb] leading-relaxed">
              India's doorstep scrap recycling platform connecting households, apartment societies, and businesses with certified local scrap collection partners.
            </p>
            <div className="flex items-center gap-2 text-xs text-[#86efac]">
              <Leaf className="w-4 h-4 text-[#4ade80] shrink-0" />
              <span>Promoting circular economy & zero-landfill cities</span>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-white mb-4">
              Quick Links
            </h4>
            <ul className="space-y-2.5 text-sm">
              <li>
                <Link to="/" className="text-[#b6c2bb] hover:text-white transition-colors">
                  Home & Overview
                </Link>
              </li>
              <li>
                <Link to="/prices" className="text-[#b6c2bb] hover:text-white transition-colors">
                  Indicative Scrap Rates
                </Link>
              </li>
              <li>
                <Link to="/book" className="hover:text-white transition-colors flex items-center gap-1.5 text-[#86efac] font-medium">
                  <span>Book Doorstep Pickup</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </li>
              <li>
                <Link to="/bookings" className="text-[#b6c2bb] hover:text-white transition-colors">
                  My Bookings Status
                </Link>
              </li>
              <li>
                <Link to="/dealer" className="hover:text-white transition-colors flex items-center gap-1.5 text-amber-300 font-medium">
                  <span>Dealer Portal</span>
                </Link>
              </li>
              <li>
                <Link to="/admin" className="hover:text-white transition-colors flex items-center gap-1.5 text-slate-300 font-medium">
                  <span>Admin Portal</span>
                </Link>
              </li>
            </ul>
          </div>

          {/* Scrap Categories */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-white mb-4">
              Scrap Categories
            </h4>
            <ul className="space-y-2.5 text-sm text-[#b6c2bb]">
              <li>
                <Link to="/prices?category=paper" className="hover:text-white transition-colors">
                  Paper & Corrugated Boxes (Raddi)
                </Link>
              </li>
              <li>
                <Link to="/prices?category=plastic" className="hover:text-white transition-colors">
                  Plastic (PET Bottles, Hard Plastic)
                </Link>
              </li>
              <li>
                <Link to="/prices?category=metal" className="hover:text-white transition-colors">
                  Metals (Iron, Copper, Brass, Aluminium)
                </Link>
              </li>
              <li>
                <Link to="/prices?category=ewaste" className="hover:text-white transition-colors">
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
            <h4 className="text-xs font-bold uppercase tracking-wider text-white mb-2">
              Metro Presence (Sample)
            </h4>
            <div className="flex flex-wrap gap-1.5 text-xs">
              {['Bengaluru', 'Mumbai', 'Delhi NCR', 'Hyderabad', 'Pune', 'Chennai'].map((city) => (
                <span
                  key={city}
                  className="px-2.5 py-1 rounded-lg bg-[#144229] text-[#dcfce7] border border-[#1e5838]"
                >
                  {city}
                </span>
              ))}
            </div>
            <div className="pt-2">
              <div className="flex items-center gap-2 text-xs text-[#a7b5ad]">
                <Scale className="w-4 h-4 text-[#86efac] shrink-0" />
                <span>Standard certified digital scale weighing</span>
              </div>
            </div>
          </div>
        </div>

        {/* Notice & Disclaimer */}
        <div className="my-8 p-4 rounded-2xl bg-[#081e13] border border-[#1b5035] text-xs text-[#cad5ce] flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0" />
          <div className="leading-relaxed">
            <span className="font-semibold text-amber-300">Disclaimer & Sample Rates Notice: </span>
            Rates displayed on Urban Scrap are sample indicative benchmarks for demonstration and guidance. Final values depend on material purity, cleanliness, and on-site electronic scale measurements by authorized local collection partners.
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
