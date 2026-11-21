export const DB_STORAGE_KEY = 'lumora_studio_db';
export const BOOKINGS_STORAGE_KEY = 'lumora_bookings';
export const USD_TO_BBD_RATE = 2.0;

export type OrderStageKey =
  | 'submitted'
  | 'viewed'
  | 'in_progress'
  | 'review'
  | 'completed';

export interface SelectedAddon {
  id: string;
  name: string;
  priceUsd: number;
}

export interface IntakeSpecs {
  eventIntent?: string;
  venueName?: string;
  venueAddress?: string;
  locationFormat?: string;
  locationValue?: string;
  amenities?: string[];
  guestNotes?: string;
  colorPalette?: string[];
  itineraryNotes?: string;
  musicChoice?: string;
  giftRegistry?: string;
  selectedAddons?: SelectedAddon[];
  uploadedMediaNames?: string[];
  uploadedAudioNames?: string[];
}

export interface OrderMessage {
  sender: string;
  text: string;
  timestamp: string;
}

export interface OrderDeliverable {
  name: string;
  type: string;
  url?: string;
  dataUrl?: string;
  uploadedAt: string;
}

export interface LumoraOrder {
  id: string;
  clientName: string;
  email: string;
  phone: string;
  packageKey: string;
  packageName: string;
  eventTitle: string;
  eventDate: string;
  totalUsd: number;
  depositPaidUsd: number;
  finalSettled: boolean;
  status: OrderStageKey;
  paymentProvider?: 'cibc' | 'bimpay' | 'mmoney' | 'wallet';
  paymentReference?: string;
  hasUnreadClientReply?: boolean;
  updatedAt?: string;
  draftApproval?: {
    status: 'pending' | 'approved' | 'revisions_requested';
    note?: string;
    updatedAt?: string;
  };
  intakeSpecs?: IntakeSpecs;
  createdAt: string;
  messages: OrderMessage[];
  deliverables: OrderDeliverable[];
}

export interface LumoraInquiry {
  id: string;
  clientName: string;
  email: string;
  channel: string;
  subject: string;
  message: string;
  status: string;
  createdAt: string;
  replies: { text: string; timestamp: string }[];
}

export interface StudioDatabase {
  orders: LumoraOrder[];
  inquiries: LumoraInquiry[];
}

export const ORDER_TRACKING_STAGES: {
  key: OrderStageKey;
  label: string;
  desc: string;
}[] = [
  { key: 'submitted', label: 'Order Submitted', desc: 'Form & deposit received.' },
  { key: 'viewed', label: 'Order Viewed', desc: 'Studio team opened and reviewed order details.' },
  { key: 'in_progress', label: 'Order in Progress', desc: 'Design and curation active in studio.' },
  { key: 'review', label: 'Ready for Review', desc: 'Draft ready for client approval.' },
  { key: 'completed', label: 'Order Completed', desc: 'Final deliverable complete and live.' },
];

export const safeText = (s: string): string => {
  if (typeof document !== 'undefined') {
    const d = document.createElement('div');
    d.textContent = s || '';
    return d.innerHTML;
  }
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

const SEED_DATABASE: StudioDatabase = {
  orders: [
    {
      id: 'ORD-2026-1001',
      clientName: 'Alexander & Julian Vance',
      email: 'julian@vanceatelier.com',
      phone: '+1 (246) 842-5133',
      packageKey: 'opulent',
      packageName: 'The Opulent Horizon',
      eventTitle: "Alexander & Julian's Wedding Weekend",
      eventDate: '2026-12-14',
      totalUsd: 510,
      depositPaidUsd: 255,
      finalSettled: false,
      status: 'in_progress',
      paymentProvider: 'cibc',
      draftApproval: { status: 'pending' },
      intakeSpecs: {
        eventIntent: 'wedding',
        venueName: 'Cobblers Cove Hotel',
        venueAddress: 'Road View, Speightstown, St. Peter',
        locationFormat: 'link',
        locationValue: 'https://maps.google.com/?q=Cobblers+Cove+Barbados',
        amenities: ['Wi-Fi Available', 'Parking / Valet', 'Restrooms'],
        guestNotes: 'Room block code VANCE26; sunset catamaran welcome at 5:30 PM.',
        colorPalette: ['#2F172C', '#F6F2EA', '#8FA89B'],
        itineraryNotes:
          'Fri 6:00 PM Welcome Rum Punch & Dinner\nSat 4:00 PM Garden Ceremony\nSun 11:00 AM Farewell Terrace Brunch',
        giftRegistry: 'https://zola.com/registry/vance',
        selectedAddons: [
          { id: 'how-we-met', name: 'Bespoke Journey / Story Timeline', priceUsd: 60 },
        ],
        uploadedMediaNames: ['cobblers_aerial.jpg', 'couple_portrait.jpg'],
        uploadedAudioNames: [],
      },
      createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
      messages: [
        {
          sender: 'LUMORA Studio',
          text: 'Deposit confirmed. Color palette extracted and wireframes initiated.',
          timestamp: new Date(Date.now() - 86400000).toISOString(),
        },
      ],
      deliverables: [],
    },
    {
      id: 'ORD-2026-1002',
      clientName: 'Camille Laurent',
      email: 'camille@laurent.bb',
      phone: '+1 (246) 555-0194',
      packageKey: 'echo2',
      packageName: 'Echo Classic',
      eventTitle: "For Maman's 70th Tribute",
      eventDate: '2026-11-28',
      totalUsd: 160,
      depositPaidUsd: 80,
      finalSettled: true,
      status: 'completed',
      paymentProvider: 'bimpay',
      draftApproval: {
        status: 'approved',
        updatedAt: new Date(Date.now() - 3600000 * 6).toISOString(),
      },
      intakeSpecs: {
        eventIntent: 'echo2',
        musicChoice: 'Soft ambient piano with warm strings',
        selectedAddons: [
          { id: 'echo2-signatures', name: 'Digital Guestbook Signatures (Up to 30)', priceUsd: 20 },
        ],
        uploadedMediaNames: [],
        uploadedAudioNames: ['Tante_Marie_Note.m4a', 'Lucas_Tribute.mp3'],
      },
      createdAt: new Date(Date.now() - 86400000 * 5).toISOString(),
      messages: [
        {
          sender: 'LUMORA Studio',
          text: 'All voice clips mastered with ambient piano score. Final keepsake uploaded to your portal.',
          timestamp: new Date(Date.now() - 3600000 * 5).toISOString(),
        },
      ],
      deliverables: [
        {
          name: 'Lumora_Echo_Laurent_Master.html',
          type: 'Interactive Keepsake Link',
          url: '#keepsake-preview',
          uploadedAt: new Date().toLocaleDateString(),
        },
      ],
    },
  ],
  inquiries: [
    {
      id: 'INQ-2026-401',
      clientName: 'Devon Thorne',
      email: 'd.thorne@barbadosyacht.com',
      channel: 'WhatsApp',
      subject: 'Custom Multi-Day Regatta Gala Suite',
      message:
        'Looking for an Opulent Horizon suite with custom crest animation for 180 guests in February.',
      status: 'Open',
      createdAt: new Date(Date.now() - 3600000 * 3).toISOString(),
      replies: [],
    },
  ],
};

export function getDatabase(): StudioDatabase {
  if (typeof window === 'undefined') return SEED_DATABASE;
  const raw = localStorage.getItem(DB_STORAGE_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as StudioDatabase;
      if (parsed && Array.isArray(parsed.orders)) {
        return {
          orders: parsed.orders,
          inquiries: Array.isArray(parsed.inquiries) ? parsed.inquiries : SEED_DATABASE.inquiries,
        };
      }
    } catch (e) {
      console.error('DB parse error', e);
    }
  }
  saveDatabase(SEED_DATABASE);
  return SEED_DATABASE;
}

export function saveDatabase(db: StudioDatabase): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(DB_STORAGE_KEY, JSON.stringify(db));
  localStorage.setItem(BOOKINGS_STORAGE_KEY, JSON.stringify(db.orders));
}

export function syncFromStorefront(): LumoraOrder[] {
  if (typeof window === 'undefined') return [];
  const rawBookings = localStorage.getItem(BOOKINGS_STORAGE_KEY);
  const bookingsData: LumoraOrder[] = JSON.parse(rawBookings || '[]');
  const db = getDatabase();

  if (bookingsData.length > 0) {
    const existingIds = new Set(db.orders.map((o) => o.id));
    let merged = false;
    bookingsData.forEach((b) => {
      if (b && b.id && !existingIds.has(b.id)) {
        db.orders.unshift(b);
        merged = true;
      }
    });
    if (merged) {
      saveDatabase(db);
    }
    return db.orders;
  }

  localStorage.setItem(BOOKINGS_STORAGE_KEY, JSON.stringify(db.orders));
  return db.orders;
}
