import React from 'react';
import { Link } from 'react-router-dom';
import { Recycle, Home, Tag, Truck } from 'lucide-react';

export const NotFoundPage: React.FC = () => {
  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4 py-16">
      <div className="max-w-md w-full glass-card rounded-3xl p-8 border border-white/[0.08] shadow-2xl text-center space-y-6 text-white">
        <div className="w-16 h-16 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 mx-auto flex items-center justify-center shadow-lg shadow-emerald-950/40">
          <Recycle className="w-8 h-8 stroke-[2.3]" />
        </div>

        <div className="space-y-2">
          <span className="text-4xl font-black text-emerald-400">404</span>
          <h1 className="text-xl font-bold text-white">Page Not Found</h1>
          <p className="text-xs sm:text-sm text-[#9cb1a4]">
            The page you're looking for doesn't exist or may have been moved.
          </p>
        </div>

        <div className="pt-2 flex flex-col gap-2.5">
          <Link
            to="/"
            className="w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-950/40 transition-colors"
          >
            <Home className="w-4 h-4" />
            <span>Return to Home</span>
          </Link>

          <Link
            to="/prices"
            className="w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm bg-white/[0.05] hover:bg-white/[0.09] text-white border border-white/10 transition-colors"
          >
            <Tag className="w-4 h-4 text-emerald-400" />
            <span>Check Scrap Prices</span>
          </Link>

          <Link
            to="/book"
            className="w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm bg-white/[0.03] hover:bg-white/[0.06] text-emerald-300 border border-emerald-500/30 transition-colors"
          >
            <Truck className="w-4 h-4" />
            <span>Book a Scrap Pickup</span>
          </Link>
        </div>
      </div>
    </div>
  );
};
