import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { SAMPLE_MATERIALS } from '../data/mockData';
import type { Material, MaterialCategory, Booking } from '../types';
import { getBookings } from './storage';
import { formatDate, getStatusDetails } from './formatters';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  isFallback?: boolean;
  actionButton?: {
    label: string;
    actionType: 'navigate' | 'open_auth';
    url?: string;
  };
}

export interface UserChatContext {
  isLoggedIn: boolean;
  userName?: string;
  userEmail?: string;
  userRole?: string;
  bookings: Array<{
    id: string;
    status: string;
    statusLabel: string;
    preferredDate: string;
    timeSlot: string;
    estimatedTotal: number;
    itemsSummary: string;
  }>;
  ratesSummary: string;
}

/**
 * Detects whether the user prompt contains Hinglish keywords.
 */
export function detectLanguage(text: string): 'hinglish' | 'english' {
  const hinglishMarkers = [
    'kya', 'hai', 'kaise', 'batao', 'kitna', 'milega', 'kab', 'aayega',
    'mera', 'meri', 'karo', 'hoga', 'chahiye', 'raddi', 'loha', 'bechna',
    'kitne', 'rupaye', 'bhai', 'nahi', 'kare', 'kaun', 'kyun', 'kaha',
    'rate', 'paisa', 'kitne me', 'uthaoge', 'kab tak', 'bikega', 'daam'
  ];
  const lower = text.toLowerCase();
  const matched = hinglishMarkers.some((word) =>
    new RegExp(`\\b${word}\\b`, 'i').test(lower)
  );
  return matched ? 'hinglish' : 'english';
}

/**
 * Fetches real active scrap rates from Supabase or fallback mock data.
 */
export async function getLiveRatesContext(): Promise<{ materials: Material[]; textSummary: string }> {
  let materialsList: Material[] = SAMPLE_MATERIALS;

  if (isSupabaseConfigured()) {
    try {
      const { data, error } = await supabase
        .from('materials')
        .select('*')
        .eq('is_active', true)
        .order('category');

      if (!error && data && data.length > 0) {
        materialsList = data.map((m) => ({
          id: m.id,
          name: m.name,
          category: m.category as MaterialCategory,
          indicativeRate: Number(m.indicative_rate),
          unit: m.unit as 'kg' | 'piece',
          description: m.description,
          popular: m.popular,
          minQuantity: m.min_quantity,
        }));
      }
    } catch (err) {
      console.warn('Failed to fetch materials for AI context, using defaults:', err);
    }
  }

  const byCat: Record<string, string[]> = {
    paper: [],
    plastic: [],
    metal: [],
    ewaste: [],
  };

  materialsList.forEach((m) => {
    const line = `${m.name}: ₹${m.indicativeRate}/${m.unit}`;
    if (byCat[m.category]) {
      byCat[m.category].push(line);
    }
  });

  const textSummary = `
CURRENT INDICATIVE SCRAP RATES (Subject to doorstep physical inspection & digital scale weighing):
- Paper & Cardboard: ${byCat.paper.join(', ')}
- Plastics: ${byCat.plastic.join(', ')}
- Metals: ${byCat.metal.join(', ')}
- E-Waste & Appliances: ${byCat.ewaste.join(', ')}
`.trim();

  return { materials: materialsList, textSummary };
}

/**
 * Retrieves the current authenticated user's bookings securely using Supabase RLS.
 */
export async function getUserBookingsContext(userId?: string): Promise<UserChatContext['bookings']> {
  if (!userId) return [];

  if (isSupabaseConfigured()) {
    try {
      // Query executes with user's JWT session, strictly protected by bookings_select_policy RLS
      const { data, error } = await (supabase.from('bookings') as any)
        .select(`
          id,
          status,
          preferred_date,
          time_slot,
          estimated_total,
          actual_total,
          booking_items (
            material_name,
            quantity,
            unit
          )
        `)
        .order('created_at', { ascending: false })
        .limit(4);

      if (!error && data) {
        return data.map((b: any) => {
          const statusInfo = getStatusDetails(b.status);
          const itemsSummary = (b.booking_items || [])
            .map((i: any) => `${i.material_name} (${i.quantity} ${i.unit})`)
            .join(', ');

          return {
            id: b.id,
            status: b.status,
            statusLabel: statusInfo.label,
            preferredDate: formatDate(b.preferred_date),
            timeSlot: b.time_slot,
            estimatedTotal: Number(b.actual_total || b.estimated_total || 0),
            itemsSummary: itemsSummary || 'Scrap items',
          };
        });
      }
    } catch (err) {
      console.warn('Could not query user bookings via Supabase:', err);
    }
  }

  // Fallback to local storage for local demo testing
  const local = getBookings().slice(0, 3);
  return local.map((b: Booking) => {
    const statusInfo = getStatusDetails(b.status);
    const itemsSummary = (b.materials || [])
      .map((i) => `${i.materialName} (${i.quantity} ${i.unit})`)
      .join(', ');

    return {
      id: b.id,
      status: b.status,
      statusLabel: statusInfo.label,
      preferredDate: formatDate(b.address.preferredDate),
      timeSlot: b.address.timeSlot,
      estimatedTotal: b.actualTotal || b.estimatedTotal,
      itemsSummary: itemsSummary || 'Scrap items',
    };
  });
}

/**
 * Verified knowledge fallback engine when OpenAI API key is not configured on the server.
 * Uses exact UrbanScrap rates, booking flow, dealer lifecycle, and real authenticated user data.
 */
export function generateVerifiedKnowledgeResponse(
  query: string,
  context: UserChatContext,
  language: 'hinglish' | 'english'
): { text: string; actionButton?: ChatMessage['actionButton'] } {
  const lower = query.toLowerCase().trim();

  // 1. BOOKING STATUS CHECK
  if (
    lower.includes('my booking') ||
    lower.includes('track') ||
    lower.includes('status') ||
    lower.includes('mera order') ||
    lower.includes('order status') ||
    lower.includes('pickup status') ||
    lower.includes('booking check')
  ) {
    if (!context.isLoggedIn) {
      return {
        text:
          language === 'hinglish'
            ? 'Aapke bookings check karne ke liye please apne UrbanScrap account me sign in karein. Security aur privacy ke kaaran sirf aapke authenticated account par hi order details dikhai jaati hain.'
            : 'To check your active pickups, please sign in to your UrbanScrap account. For security and privacy, booking status is accessible only when authenticated.',
        actionButton: {
          label: language === 'hinglish' ? 'Sign In Karein' : 'Sign In Now',
          actionType: 'open_auth',
        },
      };
    }

    if (context.bookings.length === 0) {
      return {
        text:
          language === 'hinglish'
            ? `Namaste ${context.userName || ''}! Aapke account me abhi koi active pickup booking nahi mili. Agar aap scrap bechna chahte hain toh naya pickup request schedule kar sakte hain.`
            : `Hello ${context.userName || ''}! We didn't find any active pickup bookings under your account. You can easily schedule a new doorstep scrap pickup anytime.`,
        actionButton: {
          label: language === 'hinglish' ? 'Naya Pickup Book Karein' : 'Book a Pickup',
          actionType: 'navigate',
          url: '/book',
        },
      };
    }

    const bookingList = context.bookings
      .map(
        (b) =>
          `• Order #${b.id}: **${b.statusLabel}** | Date: ${b.preferredDate} (${b.timeSlot}) | Items: ${b.itemsSummary} | Est. ₹${b.estimatedTotal}`
      )
      .join('\n');

    return {
      text:
        language === 'hinglish'
          ? `Aapke recent bookings yeh rahe:\n\n${bookingList}\n\n*Note: Doorstep par certified digital scale se weighing ke baad final payout instantly UPI ya Cash me milta hai.*`
          : `Here are your recent pickup bookings:\n\n${bookingList}\n\n*Note: Final payout is calculated and paid immediately on-site after digital weighing.*`,
      actionButton: {
        label: language === 'hinglish' ? 'My Bookings Kholein' : 'View All Bookings',
        actionType: 'navigate',
        url: '/bookings',
      },
    };
  }

  // 2. SCRAP RATES & CATEGORIES
  if (
    lower.includes('rate') ||
    lower.includes('price') ||
    lower.includes('daam') ||
    lower.includes('bhav') ||
    lower.includes('paisa') ||
    lower.includes('newspaper') ||
    lower.includes('raddi') ||
    lower.includes('iron') ||
    lower.includes('loha') ||
    lower.includes('plastic') ||
    lower.includes('copper') ||
    lower.includes('aluminium') ||
    lower.includes('e-waste') ||
    lower.includes('ewaste')
  ) {
    let specificAnswer = '';

    if (lower.includes('newspaper') || lower.includes('raddi')) {
      specificAnswer =
        language === 'hinglish'
          ? 'Newspaper (Raddi) ka benchmark rate lagbhag **₹14 / kg** hai.'
          : 'Newspaper (Raddi) has an indicative benchmark rate of **₹14 / kg**.';
    } else if (lower.includes('iron') || lower.includes('loha')) {
      specificAnswer =
        language === 'hinglish'
          ? 'Iron Scrap (Loha) ka benchmark rate lagbhag **₹28 / kg** hai.'
          : 'Iron Scrap (Loha) is currently benchmarked at **₹28 / kg**.';
    } else if (lower.includes('copper') || lower.includes('tamba')) {
      specificAnswer =
        language === 'hinglish'
          ? 'Copper Wire & Piping ka rate lagbhag **₹420 / kg** hai.'
          : 'Copper Wire & Piping is currently benchmarked at **₹420 / kg**.';
    } else if (lower.includes('aluminium')) {
      specificAnswer =
        language === 'hinglish'
          ? 'Aluminium scrap ka benchmark rate lagbhag **₹110 / kg** hai.'
          : 'Aluminium Scrap has an indicative rate of **₹110 / kg**.';
    } else if (lower.includes('cardboard') || lower.includes('gatta') || lower.includes('carton')) {
      specificAnswer =
        language === 'hinglish'
          ? 'Cardboard / Corrugated Boxes ka rate lagbhag **₹11 / kg** hai.'
          : 'Cardboard / Corrugated Boxes are benchmarked at **₹11 / kg**.';
    } else if (lower.includes('plastic') || lower.includes('bottle')) {
      specificAnswer =
        language === 'hinglish'
          ? 'PET Bottles ka rate **₹18 / kg** aur Mixed Hard Plastic ka rate **₹9 / kg** hai.'
          : 'PET Bottles are benchmarked at **₹18 / kg** and Mixed Hard Plastic at **₹9 / kg**.';
    } else if (lower.includes('e-waste') || lower.includes('ewaste') || lower.includes('battery')) {
      specificAnswer =
        language === 'hinglish'
          ? 'Small E-waste **₹35 / kg**, Lead-Acid Batteries **₹65 / kg**, aur Heavy Appliances **₹250 / piece** benchmark rate par hain.'
          : 'Small E-waste is at **₹35 / kg**, Batteries at **₹65 / kg**, and Heavy Appliances at **₹250 / piece**.';
    }

    const ratesOverview = `\n\n${context.ratesSummary}\n\n⚠️ **Important Pricing Rule:**\nPlatform par dikhaye gaye rates indicative (anumaanit) hain. Final amount dealer ke physical inspection aur digital electronic scale par weighing ke baad hi tay hota hai.`;

    return {
      text: (specificAnswer ? `${specificAnswer}\n\n` : '') + ratesOverview,
      actionButton: {
        label: language === 'hinglish' ? 'Poora Price Directory Dekhein' : 'Explore Full Rate Card',
        actionType: 'navigate',
        url: '/prices',
      },
    };
  }

  // 3. HOW TO BOOK A PICKUP
  if (
    lower.includes('book') ||
    lower.includes('request') ||
    lower.includes('pickup') ||
    lower.includes('kaise') ||
    lower.includes('schedule') ||
    lower.includes('how to')
  ) {
    const steps =
      language === 'hinglish'
        ? `Urban Scrap par doorstep pickup schedule karna bohot aasan hai:
1. **Choose Materials**: Paper, Plastic, Metal ya E-Waste me se apne items aur estimated quantity select karein.
2. **Pickup Details**: Apna address, phone number, aur pincode enter karein.
3. **Date & Slot**: Apni pasandida date aur convenient time slot (Morning, Afternoon, Evening) chunein.
4. **Partner Assignment**: Pincode ke verified dealer ko aapka request assign hota hai.
5. **Weighing & Payment**: Dealer certified digital scale le kar doorstep par weighing karega aur spot payout (UPI / Cash) dega.`
        : `Booking a doorstep scrap pickup on Urban Scrap takes under 2 minutes:
1. **Select Materials**: Choose scrap items across Paper, Plastic, Metal, and E-Waste with approximate weight.
2. **Doorstep Address**: Enter your complete pickup address, city, and pincode.
3. **Convenient Time Window**: Pick your preferred date and time slot (Morning, Afternoon, Late Afternoon, Evening).
4. **Partner Assigned**: A verified local scrap dealer is assigned to your request.
5. **Digital Weighing & Instant Payment**: The partner visits your doorstep with a digital scale and provides on-the-spot payout via instant UPI or Cash.`;

    return {
      text: steps,
      actionButton: {
        label: language === 'hinglish' ? 'Pickup Schedule Karein' : 'Book Doorstep Pickup',
        actionType: 'navigate',
        url: '/book',
      },
    };
  }

  // 4. DEALER PARTNER & GST VERIFICATION
  if (
    lower.includes('dealer') ||
    lower.includes('partner') ||
    lower.includes('gst') ||
    lower.includes('verification') ||
    lower.includes('kabadiwala') ||
    lower.includes('merchant')
  ) {
    const dealerInfo =
      language === 'hinglish'
        ? `**Urban Scrap Dealer Partner Program:**
• Commercial scrap dealers / kabadiwalas hamare platform par apply kar sakte hain.
• Unhe business name, vehicle type (EV Loader / Three-Wheeler), operational area, aur valid 15-character **GSTIN** submit karna hota hai.
• **Admin Verification**: Urban Scrap administrators official GST government portal par manual verification karte hain.
• Approve hone ke baad hi dealer ko partner dashboard aur pickup leads access milta hai.
• Customer safety ke liye sabhi partners background-checked aur verified hote hain.`
        : `**Urban Scrap Dealer Partner Program:**
• Commercial scrap merchants can join as authorized collection partners.
• Requirements include business details, EV vehicle type, service zone, and a valid 15-digit **GSTIN**.
• **Manual Admin Audit**: Urban Scrap administrators cross-verify all GST credentials against the official GST portal before granting approval.
• Once approved, dealers unlock their commercial dispatch dashboard to claim pickups, conduct doorstep weighing, and record payouts.`;

    return {
      text: dealerInfo,
      actionButton: {
        label: language === 'hinglish' ? 'Dealer Portal Dekhein' : 'Dealer Portal',
        actionType: 'navigate',
        url: '/dealer',
      },
    };
  }

  // 5. USER ROLES & PERMISSIONS
  if (
    lower.includes('role') ||
    lower.includes('admin') ||
    lower.includes('customer') ||
    lower.includes('permission') ||
    lower.includes('access')
  ) {
    const rolesInfo =
      language === 'hinglish'
        ? `Urban Scrap me 3 roles hote hain:
1. **Customer**: Doorstep scrap pickup book kar sakte hain aur apne orders ko live track kar sakte hain.
2. **Dealer Partner**: GST-verified commercial scrap merchants jo bookings claim karke digital weighing aur payout karte hain.
3. **Admin**: Trusted administrators jo incoming dealer applications ko verify karte hain, materials & rates manage karte hain, aur audit trails monitor karte hain.`
        : `Urban Scrap supports three distinct roles protected by database Row-Level Security (RLS):
1. **Customer**: Can book scrap pickups, select materials, and track their own order lifecycle.
2. **Dealer Partner**: GST-verified scrap collection partners who claim neighborhood leads, perform digital scale weighing, and complete payouts.
3. **Administrator**: Manages dealer GST verification, regulates material benchmarks, and audits compliance.`;

    return {
      text: rolesInfo,
    };
  }

  // 6. DEFAULT HELPFUL FALLBACK
  const defaultReply =
    language === 'hinglish'
      ? `Main Urban Scrap ka AI support assistant hoon. Main aapki in cheezon me madad kar sakta hoon:
• **Scrap Rates**: Newspaper, Loha, Plastic, Copper, E-waste ke latest indicative rates.
• **Pickup Request**: Doorstep pickup schedule karne ka step-by-step process.
• **Order Tracking**: Apne active booking ka status check karna.
• **Dealer Verification**: GST-verified scrap partners ke baare me jaankari.

Aap mujhse koi bhi sawal pooch sakte hain ya neeche diye buttons par click karein.`
      : `I am your UrbanScrap AI Support assistant. Here is what I can help you with:
• **Indicative Scrap Rates**: Latest benchmarks for Paper, Plastic, Metal, and E-Waste.
• **Doorstep Pickup**: How to book a pickup, select your slot, and prepare scrap.
• **Track Bookings**: Check live status of your doorstep collection requests.
• **Dealer Verification**: Information about our GST-verified collection partners and safety standards.

Feel free to ask any question or tap one of the quick suggestions below!`;

  return {
    text: defaultReply,
    actionButton: {
      label: language === 'hinglish' ? 'Scrap Rates Dekhein' : 'View Scrap Rates',
      actionType: 'navigate',
      url: '/prices',
    },
  };
}

/**
 * Sends chat messages to the Supabase Edge Function `chat-support`.
 * If the Edge Function is not deployed or OPENAI_API_KEY is not configured,
 * it falls back cleanly to the verified UrbanScrap Knowledge Engine.
 */
export async function sendChatMessage(
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
  user: any,
  language: 'hinglish' | 'english'
): Promise<{ text: string; isFallback: boolean; setupRequired?: boolean; actionButton?: ChatMessage['actionButton'] }> {
  const latestUserMessage = messages[messages.length - 1]?.content || '';

  // 0. Validate message length limit
  if (latestUserMessage.length > 500) {
    return {
      text:
        language === 'hinglish'
          ? 'Aapka message 500 characters se zyada lamba hai. Kripya thoda sankshipt (short) karke poochhein.'
          : 'Your message exceeds the 500-character limit. Please shorten your inquiry so I can assist you promptly.',
      isFallback: false,
    };
  }

  // 1. Prepare live context from database & authenticated user session
  const { textSummary: ratesSummary } = await getLiveRatesContext();
  const userBookings = await getUserBookingsContext(user?.id);

  const userContext: UserChatContext = {
    isLoggedIn: !!user,
    userName: user?.user_metadata?.full_name || user?.email?.split('@')[0] || undefined,
    userEmail: user?.email,
    userRole: user?.role,
    bookings: userBookings,
    ratesSummary,
  };

  // 2. Guests & unauthenticated users use the Verified Knowledge Base directly
  // This guarantees fast, accurate responses without consuming AI quota or failing JWT auth.
  if (!user) {
    const fallback = generateVerifiedKnowledgeResponse(latestUserMessage, userContext, language);
    return {
      text: fallback.text,
      isFallback: true,
      setupRequired: false,
      actionButton: fallback.actionButton,
    };
  }

  // 3. Authenticated users call the secure Supabase Edge Function with JWT verification
  if (isSupabaseConfigured()) {
    try {
      const { data, error } = await supabase.functions.invoke('chat-support', {
        body: {
          messages,
          context: userContext,
          language,
        },
      });

      // Handle rate limiting (429) or validation errors from edge function
      if (error) {
        const errStr = (error.message || '').toLowerCase();
        if (errStr.includes('rate limit') || errStr.includes('429')) {
          return {
            text:
              language === 'hinglish'
                ? 'Aapne kaafi jaldi-jaldi messages bheje hain. Kripya 1 minute rukiye aur dobara try kijiye.'
                : 'Rate limit reached: You have sent several messages in a short time. Please wait a minute before asking again.',
            isFallback: false,
          };
        }
      }

      // If Edge Function responded with successful completion
      if (!error && data && data.reply) {
        return {
          text: data.reply,
          isFallback: false,
        };
      }

      // If Edge Function explicitly signaled that OPENAI_API_KEY is not configured
      if (data && data.setupRequired) {
        const fallback = generateVerifiedKnowledgeResponse(latestUserMessage, userContext, language);
        return {
          text: fallback.text,
          isFallback: true,
          setupRequired: true,
          actionButton: fallback.actionButton,
        };
      }
    } catch (edgeErr) {
      console.info('Supabase Edge Function not reachable or pending deployment. Falling back to local verified knowledge base:', edgeErr);
    }
  }

  // 4. Fallback for authenticated user if Edge Function is offline or misconfigured
  const fallback = generateVerifiedKnowledgeResponse(latestUserMessage, userContext, language);
  return {
    text: fallback.text,
    isFallback: true,
    setupRequired: true,
    actionButton: fallback.actionButton,
  };
}
