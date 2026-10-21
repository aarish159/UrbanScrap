import React from 'react';
import { Link } from 'react-router-dom';
import { Recycle, Home, Tag, Truck } from 'lucide-react';

export const NotFoundPage: React.FC = () => {
  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4 py-16">
      <div className="max-w-md w-full bg-white rounded-3xl p-8 border border-[#e8e8e3] shadow-lg text-center space-y-6">
        <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-700 mx-auto flex items-center justify-center">
          <Recycle className="w-8 h-8 text-[#16a34a] stroke-[2.3]" />
        </div>

        <div className="space-y-2">
          <span className="text-4xl font-black text-[#143e29]">404</span>
          <h1 className="text-xl font-bold text-[#143e29]">Page Not Found</h1>
          <p className="text-xs sm:text-sm text-[#555c58]">
            The page you're looking for doesn't exist or may have been moved.
          </p>
        </div>

        <div className="pt-2 flex flex-col gap-2.5">
          <Link
            to="/"
            className="w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm bg-[#143e29] text-white hover:bg-[#1a5336] transition-colors"
          >
            <Home className="w-4 h-4" />
            <span>Return to Home</span>
          </Link>

          <Link
            to="/prices"
            className="w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm bg-[#f1f3f1] text-[#191c1a] hover:bg-[#e2e4e1] transition-colors"
          >
            <Tag className="w-4 h-4" />
            <span>Check Scrap Prices</span>
          </Link>

          <Link
            to="/book"
            className="w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm bg-white text-[#16a34a] border border-[#16a34a]/30 hover:bg-[#f0fdf4] transition-colors"
          >
            <Truck className="w-4 h-4" />
            <span>Book a Scrap Pickup</span>
          </Link>
        </div>
      </div>
    </div>
  );
};
