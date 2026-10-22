import React, { useState, useMemo, useEffect } from 'react';
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
  X,
  Database,
} from 'lucide-react';
import { SAMPLE_MATERIALS } from '../data/mockData';
import type { Material, MaterialCategory } from '../types';
import { formatINR, getCategoryBadge } from '../utils/formatters';
import { useScrollAnimation } from '../utils/useScrollAnimation';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

export const PriceDirectoryPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, openAuthModal } = useAuth();
  useScrollAnimation();

  const [materials, setMaterials] = useState<Material[]>(SAMPLE_MATERIALS);
  const [isLiveFromDb, setIsLiveFromDb] = useState(false);
  const currentCategory = (searchParams.get('category') as MaterialCategory | 'all') || 'all';
  const [searchTerm, setSearchTerm] = useState('');

  // Fetch active materials from Supabase if configured
  useEffect(() => {
    if (isSupabaseConfigured()) {
      supabase
        .from('materials')
        .select('*')
        .eq('is_active', true)
        .order('name')
        .then(({ data, error }) => {
          if (!error && data && data.length > 0) {
            setMaterials(
              data.map((m) => ({
                id: m.id,
                name: m.name,
                category: m.category as MaterialCategory,
                indicativeRate: Number(m.indicative_rate),
                unit: m.unit as 'kg' | 'piece',
                description: m.description,
                popular: m.popular,
                minQuantity: m.min_quantity,
              }))
            );
            setIsLiveFromDb(true);
          }
        });
    }
  }, []);

  const categories: {
    id: MaterialCategory | 'all';
    label: string;
    icon: React.FC<{ className?: string }>;
    count: number;
  }[] = [
    {
      id: 'all',
      label: 'All Materials',
      icon: Filter,
      count: materials.length,
    },
    {
      id: 'paper',
      label: 'Paper & Cardboard',
      icon: Package,
      count: materials.filter((m) => m.category === 'paper').length,
    },
    {
      id: 'plastic',
      label: 'Plastic',
      icon: Layers,
      count: materials.filter((m) => m.category === 'plastic').length,
    },
    {
      id: 'metal',
      label: 'Metals',
      icon: Scale,
      count: materials.filter((m) => m.category === 'metal').length,
    },
    {
      id: 'ewaste',
      label: 'E-Waste',
      icon: Cpu,
      count: materials.filter((m) => m.category === 'ewaste').length,
    },
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
    return materials.filter((mat) => {
      const matchesCategory =
        currentCategory === 'all' || mat.category === currentCategory;
      const q = searchTerm.toLowerCase().trim();
      const matchesSearch =
        q === '' ||
        mat.name.toLowerCase().includes(q) ||
        mat.description.toLowerCase().includes(q);
      return matchesCategory && matchesSearch;
    });
  }, [materials, currentCategory, searchTerm]);

  const handleAddToPickup = (materialId: string) => {
    const target = `/book?material=${encodeURIComponent(materialId)}`;
    if (!user) {
      openAuthModal({
        initialRole: 'customer',
        returnTo: target,
        reasonMessage: 'Please sign in to add this scrap item to your pickup.',
      });
    } else {
      navigate(target);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Page Title & Overview */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-50/90 border border-amber-200 text-xs font-semibold text-amber-900 mb-2">
              {isLiveFromDb ? (
                <>
                  <Database className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>Live Supabase Material Directory • Sample Market Rates</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  <span>Sample Indicative Benchmarks • Prevailing Market Averages</span>
                </>
              )}
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-[#123b26] tracking-tight">
              Indicative Scrap Price Directory
            </h1>
          </div>

          <Link
            to="/book"
            onClick={(e) => {
              if (!user) {
                e.preventDefault();
                openAuthModal({
                  initialRole: 'customer',
                  returnTo: '/book',
                  reasonMessage: 'Please sign in or create an account to schedule your pickup.',
                });
              }
            }}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold bg-[#16a34a] hover:bg-[#15803d] text-white shadow-md shadow-[#16a34a]/20 transition-all self-start sm:self-center active:scale-[0.98]"
          >
            <Truck className="w-4 h-4 shrink-0" />
            <span>Book a Custom Pickup</span>
          </Link>
        </div>

        <p className="text-[#525955] text-sm sm:text-base max-w-3xl leading-relaxed">
          Browse indicative per-kilogram and per-piece rates across common household and business recyclables. All rates are <strong className="text-[#191c1a] font-semibold">sample benchmarks</strong> for guidance. Final value is evaluated on-site by your authorized partner based on material cleanliness, purity grades, and certified digital scale measurements.
        </p>
      </div>

      {/* Prominent but restrained Sample Rates Disclaimer */}
      <div className="p-4 sm:p-5 rounded-2xl bg-amber-50/90 border border-amber-300/80 text-amber-950 flex items-start gap-3.5 shadow-xs">
        <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div className="text-xs sm:text-sm leading-relaxed">
          <p className="font-bold text-amber-900">
            Important Notice: Sample Benchmark Rates
          </p>
          <p className="text-amber-800/90 mt-0.5">
            Secondary commodity rates fluctuate across Indian metropolitan cities (Bengaluru, Mumbai, Delhi NCR, Pune, etc.) depending on recycling mill demand. On-site authorized scrap partners verify purity grades, moisture levels, and exact electronic weights before settling payout.
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
              className="w-full pl-10 pr-9 py-2.5 text-sm rounded-xl border border-[#d1d5db] bg-white focus:outline-none focus:ring-2 focus:ring-[#16a34a] text-[#191c1a] placeholder-[#9aa19d] shadow-xs transition-colors"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-[#717a75] hover:text-[#191c1a] rounded-md transition-colors"
                aria-label="Clear search input"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="text-xs text-[#717a75] font-semibold self-end sm:self-center">
            Showing <span className="font-bold text-[#123b26]">{filteredMaterials.length}</span> of {SAMPLE_MATERIALS.length} items
          </div>
        </div>

        {/* Category Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1.5 scrollbar-none">
          {categories.map((cat) => {
            const Icon = cat.icon;
            const isSelected = currentCategory === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => handleCategoryChange(cat.id)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold whitespace-nowrap transition-all duration-150 active:scale-[0.98] ${
                  isSelected
                    ? 'bg-[#123b26] text-white shadow-sm'
                    : 'bg-white text-[#3f4541] border border-[#d1d5db] hover:border-[#123b26] hover:bg-[#eef2ee]'
                }`}
              >
                <Icon className={`w-4 h-4 shrink-0 stroke-[2.2] ${isSelected ? 'text-[#4ade80]' : 'text-[#717a75]'}`} />
                <span>{cat.label}</span>
                <span
                  className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full ${
                    isSelected ? 'bg-[#17482f] text-[#86efac]' : 'bg-[#f1f3f1] text-[#717a75]'
                  }`}
                >
                  {cat.count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Materials Table / List */}
      {filteredMaterials.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-[#e6e8e5] space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-700 mx-auto flex items-center justify-center">
            <AlertCircle className="w-7 h-7 stroke-[2]" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-[#123b26]">No materials match your query</h3>
            <p className="text-sm text-[#717a75] mt-1 max-w-md mx-auto">
              We couldn't find any scrap items matching "{searchTerm}". Try searching for paper, cardboard, iron, or plastic.
            </p>
          </div>
          <div className="pt-2 flex justify-center gap-3">
            <button
              type="button"
              onClick={() => {
                setSearchTerm('');
                handleCategoryChange('all');
              }}
              className="px-4 py-2 rounded-xl text-sm font-semibold bg-[#f1f3f1] text-[#191c1a] hover:bg-[#e2e4e1] transition-colors"
            >
              Reset Filters
            </button>
            <Link
              to="/book"
              className="px-4 py-2 rounded-xl text-sm font-semibold bg-[#16a34a] text-white hover:bg-[#15803d] transition-colors"
            >
              Proceed to Custom Booking
            </Link>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-[#e6e8e5] shadow-xs overflow-hidden">
          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#f8faf9] border-b border-[#e6e8e5] text-[11px] font-bold uppercase tracking-wider text-[#717a75]">
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
                        <div className="font-bold text-[#123b26] text-base group-hover:text-[#16a34a] transition-colors flex items-center gap-2">
                          <span>{mat.name}</span>
                          {mat.popular && (
                            <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                              High Demand
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-[#525955] mt-0.5 max-w-md">
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

                      <td className="py-4 px-4 whitespace-nowrap text-[#525955] font-semibold text-xs">
                        Per {mat.unit}
                      </td>

                      <td className="py-4 px-6 whitespace-nowrap">
                        <div className="text-lg font-black text-[#123b26]">
                          {formatINR(mat.indicativeRate)}{' '}
                          <span className="text-xs font-semibold text-[#717a75]">/ {mat.unit}</span>
                        </div>
                        <span className="text-[10px] text-[#9aa19d] block font-medium">
                          Sample benchmark rate
                        </span>
                      </td>

                      <td className="py-4 px-6 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => handleAddToPickup(mat.id)}
                          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-[#123b26] hover:bg-[#16a34a] text-white shadow-xs transition-all active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#16a34a]"
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
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h2 className="font-bold text-base text-[#123b26]">{mat.name}</h2>
                        {mat.popular && (
                          <span className="px-1.5 py-0.2 text-[9px] font-bold rounded bg-emerald-50 text-emerald-800 border border-emerald-200">
                            High Demand
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-[#525955] mt-1 leading-snug">
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
                      <div className="text-base font-black text-[#123b26]">
                        {formatINR(mat.indicativeRate)}{' '}
                        <span className="text-xs font-normal text-[#717a75]">/ {mat.unit}</span>
                      </div>
                      <span className="text-[10px] text-[#9aa19d] font-medium">Sample rate</span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleAddToPickup(mat.id)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-[#123b26] active:bg-[#16a34a] text-white shadow-xs"
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

      {/* Helpful bottom commercial callout */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-[#eaf8ef] to-[#fbfbf9] border border-[#bbf7d0] flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h2 className="font-bold text-[#123b26]">Have commercial volumes or unlisted items?</h2>
          <p className="text-xs sm:text-sm text-[#525955] mt-0.5">
            We handle bulk pickups for RWAs, factories, schools, and offices with custom weighing equipment and vehicles.
          </p>
        </div>
        <Link
          to="/book"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold bg-[#16a34a] text-white hover:bg-[#15803d] shrink-0 active:scale-[0.98] transition-all"
        >
          <span>Schedule Pickup</span>
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
};
