import React, { useState, useMemo } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import {
  Search,
  Filter,
  Truck,
  PlusCircle,
  AlertCircle,
  ArrowRight,
  ShieldAlert,
  Sparkles,
  Layers,
  Package,
  Scale,
  Cpu,
} from 'lucide-react';
import { SAMPLE_MATERIALS } from '../data/mockData';
import type { MaterialCategory } from '../types';
import { formatINR, getCategoryBadge } from '../utils/formatters';

export const PriceDirectoryPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const currentCategory = (searchParams.get('category') as MaterialCategory | 'all') || 'all';
  const [searchTerm, setSearchTerm] = useState('');

  const categories: { id: MaterialCategory | 'all'; label: string; icon: React.FC<{ className?: string }> }[] = [
    { id: 'all', label: 'All Categories', icon: Filter },
    { id: 'paper', label: 'Paper & Cardboard', icon: Package },
    { id: 'plastic', label: 'Plastic', icon: Layers },
    { id: 'metal', label: 'Metals', icon: Scale },
    { id: 'ewaste', label: 'E-Waste', icon: Cpu },
  ];

  const handleCategoryChange = (cat: MaterialCategory | 'all') => {
    if (cat === 'all') {
      searchParams.delete('category');
    } else {
      searchParams.set('category', cat);
    }
    setSearchParams(searchParams);
  };

  const filteredMaterials = useMemo(() => {
    return SAMPLE_MATERIALS.filter((mat) => {
      const matchesCategory =
        currentCategory === 'all' || mat.category === currentCategory;
      const matchesSearch =
        mat.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        mat.description.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [currentCategory, searchTerm]);

  const handleAddToPickup = (materialId: string) => {
    // Navigate to /book with the selected material preselected
    navigate(`/book?material=${encodeURIComponent(materialId)}`);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Page Title & Explanation */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-xs font-semibold text-amber-900 mb-2">
              <Sparkles className="w-3.5 h-3.5 text-amber-600" />
              <span>Sample Indicative Benchmarks • Updated Daily</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-[#143e29] tracking-tight">
              Indicative Scrap Price Directory
            </h1>
          </div>

          <Link
            to="/book"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold bg-[#16a34a] hover:bg-[#15803d] text-white shadow-md shadow-[#16a34a]/20 transition-all"
          >
            <Truck className="w-4 h-4" />
            <span>Book a Custom Pickup</span>
          </Link>
        </div>

        <p className="text-[#555c58] text-sm sm:text-base max-w-3xl leading-relaxed">
          Explore benchmark rates across common household and business recyclables. All rates displayed below are <strong className="text-[#191c1a]">sample indicative values</strong> for general guidance. Final value is determined on-site by the authorized dealer based on cleanliness, purity grades, and digital scale weights.
        </p>
      </div>

      {/* Prominent Sample Values Disclaimer Banner */}
      <div className="p-4 sm:p-5 rounded-2xl bg-amber-50/90 border border-amber-300/80 text-amber-950 flex items-start gap-3.5 shadow-sm">
        <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div className="text-xs sm:text-sm leading-relaxed">
          <p className="font-bold text-amber-900">
            Important Notice: These are Sample Indicative Rates
          </p>
          <p className="text-amber-800/90 mt-0.5">
            Prices vary dynamically across Indian cities (Bengaluru, Mumbai, Delhi, etc.) due to local secondary recycling mill demand. Scrap dealers verify material moisture, non-recyclable contamination, and exact digital weight before finalizing payout.
          </p>
        </div>
      </div>

      {/* Controls: Search & Category Filter Tabs */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-4 justify-between items-stretch sm:items-center">
          {/* Search Box */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#717a75]" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by material (e.g. Newspaper, Copper, PET)..."
              className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl border border-[#d1d5db] bg-white focus:outline-none focus:ring-2 focus:ring-[#16a34a] focus:border-transparent text-[#191c1a] placeholder-[#9aa19d] shadow-sm"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#717a75] hover:text-[#191c1a]"
              >
                Clear
              </button>
            )}
          </div>

          <div className="text-xs text-[#717a75] font-medium self-end sm:self-center">
            Showing <span className="font-bold text-[#143e29]">{filteredMaterials.length}</span> items
          </div>
        </div>

        {/* Category Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          {categories.map((cat) => {
            const Icon = cat.icon;
            const isSelected = currentCategory === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => handleCategoryChange(cat.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold whitespace-nowrap transition-all ${
                  isSelected
                    ? 'bg-[#143e29] text-white shadow-sm'
                    : 'bg-white text-[#3f4441] border border-[#d1d5db] hover:border-[#143e29] hover:bg-[#f1f3f1]'
                }`}
              >
                <Icon className={`w-4 h-4 ${isSelected ? 'text-[#4ade80]' : 'text-[#717a75]'}`} />
                <span>{cat.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Materials Table / List */}
      {filteredMaterials.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-[#e8e8e3] space-y-4">
          <div className="w-14 h-14 rounded-full bg-amber-50 text-amber-700 mx-auto flex items-center justify-center">
            <AlertCircle className="w-7 h-7" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-[#143e29]">No materials match your query</h3>
            <p className="text-sm text-[#717a75] mt-1 max-w-md mx-auto">
              We couldn't find any scrap items matching "{searchTerm}". Try searching for paper, cardboard, iron, or plastic.
            </p>
          </div>
          <div className="pt-2 flex justify-center gap-3">
            <button
              onClick={() => {
                setSearchTerm('');
                handleCategoryChange('all');
              }}
              className="px-4 py-2 rounded-xl text-sm font-semibold bg-[#f1f3f1] text-[#191c1a] hover:bg-[#e2e4e1]"
            >
              Reset Filters
            </button>
            <Link
              to="/book"
              className="px-4 py-2 rounded-xl text-sm font-semibold bg-[#16a34a] text-white hover:bg-[#15803d]"
            >
              Proceed to Custom Booking
            </Link>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-[#e8e8e3] shadow-sm overflow-hidden">
          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#f8faf9] border-b border-[#e8e8e3] text-[11px] font-bold uppercase tracking-wider text-[#717a75]">
                  <th className="py-4 px-6">Material & Grade</th>
                  <th className="py-4 px-4">Category</th>
                  <th className="py-4 px-4">Unit</th>
                  <th className="py-4 px-6">Indicative Rate</th>
                  <th className="py-4 px-6 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f1f3f1] text-sm">
                {filteredMaterials.map((mat) => {
                  const catBadge = getCategoryBadge(mat.category);
                  return (
                    <tr
                      key={mat.id}
                      className="hover:bg-[#fbfbf9] transition-colors group"
                    >
                      <td className="py-4 px-6">
                        <div className="font-bold text-[#143e29] text-base group-hover:text-[#16a34a] transition-colors flex items-center gap-2">
                          <span>{mat.name}</span>
                          {mat.popular && (
                            <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                              Popular
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-[#555c58] mt-0.5 max-w-md">
                          {mat.description}
                        </p>
                      </td>

                      <td className="py-4 px-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold border ${catBadge.colorClass}`}
                        >
                          {catBadge.label}
                        </span>
                      </td>

                      <td className="py-4 px-4 whitespace-nowrap text-[#555c58] font-medium">
                        Per {mat.unit}
                      </td>

                      <td className="py-4 px-6 whitespace-nowrap">
                        <div className="text-lg font-extrabold text-[#143e29]">
                          {formatINR(mat.indicativeRate)}{' '}
                          <span className="text-xs font-normal text-[#717a75]">/ {mat.unit}</span>
                        </div>
                        <span className="text-[10px] text-[#9aa19d] block">
                          Sample benchmark rate
                        </span>
                      </td>

                      <td className="py-4 px-6 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => handleAddToPickup(mat.id)}
                          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-[#143e29] hover:bg-[#16a34a] text-white shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-[#16a34a]"
                        >
                          <PlusCircle className="w-3.5 h-3.5" />
                          <span>Add to pickup</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Card List View */}
          <div className="md:hidden divide-y divide-[#f1f3f1]">
            {filteredMaterials.map((mat) => {
              const catBadge = getCategoryBadge(mat.category);
              return (
                <div key={mat.id} className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <h4 className="font-bold text-base text-[#143e29]">{mat.name}</h4>
                        {mat.popular && (
                          <span className="px-1.5 py-0.2 text-[9px] font-bold rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                            Popular
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-[#555c58] mt-1 leading-snug">
                        {mat.description}
                      </p>
                    </div>
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold border shrink-0 ${catBadge.colorClass}`}
                    >
                      {catBadge.label}
                    </span>
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <div>
                      <div className="text-base font-extrabold text-[#143e29]">
                        {formatINR(mat.indicativeRate)}{' '}
                        <span className="text-xs font-normal text-[#717a75]">/ {mat.unit}</span>
                      </div>
                      <span className="text-[10px] text-[#9aa19d]">Sample rate</span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleAddToPickup(mat.id)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-[#143e29] text-white"
                    >
                      <PlusCircle className="w-3.5 h-3.5" />
                      <span>Add to pickup</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Helpful bottom callout */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-[#f0fdf4] to-[#fbfbf9] border border-[#bbf7d0] flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h4 className="font-bold text-[#143e29]">Have commercial volumes or unlisted items?</h4>
          <p className="text-xs sm:text-sm text-[#555c58] mt-0.5">
            We handle bulk clearances for RWAs, factories, schools, and offices with custom weighing trucks.
          </p>
        </div>
        <Link
          to="/book"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold bg-[#16a34a] text-white hover:bg-[#15803d] shrink-0"
        >
          <span>Schedule Pickup</span>
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
};
