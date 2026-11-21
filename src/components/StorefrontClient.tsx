'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  BOOKINGS_STORAGE_KEY,
  DB_STORAGE_KEY,
  LumoraOrder,
  ORDER_TRACKING_STAGES,
  USD_TO_BBD_RATE,
  getDatabase,
  safeText,
  saveDatabase,
} from '@/lib/store';
import { processCibcPayment } from '@/lib/payments/cibc';
import { processBimpayPayment } from '@/lib/payments/bimpay';
import { processMmoneyPayment } from '@/lib/payments/mmoney';
import { processWalletPayment } from '@/lib/payments/wallet';

type PaymentGateway = 'cibc' | 'bimpay' | 'mmoney' | 'wallet';

interface AddonDef {
  id: string;
  name: string;
  price: number;
  desc: string;
}

interface PackageDef {
  name: string;
  basePrice: number;
  subText: string;
  inclusions: string[];
  addons: AddonDef[];
}

interface FormFieldDef {
  id: string;
  label: string;
  type:
    | 'text'
    | 'email'
    | 'date'
    | 'url'
    | 'textarea'
    | 'select'
    | 'checkbox-group'
    | 'phone'
    | 'file'
    | 'echo-cloud-hub'
    | 'location-interactive'
    | 'palette-capture';
  placeholder?: string;
  required?: boolean;
  multiple?: boolean;
  accept?: string;
  options?: { value: string; text?: string; label?: string }[];
}

interface FormRowDef {
  accordion: 1 | 2 | 3;
  grid?: FormFieldDef[];
  fields?: FormFieldDef[];
}

const EVENT_INTENT_OPTIONS = [
  { id: 'wedding', name: 'Wedding / Multi-Day Weekend', desc: 'Weddings, welcome dinners, farewell brunches & destination retreats.' },
  { id: 'memorial', name: 'Bereavement / Memorial / Repast', desc: 'Respectful, dignified gatherings focusing on venue, order of service, and warm RSVPs.' },
  { id: 'kids', name: "Kid's Party / Casual Birthday", desc: 'Playful, direct RSVPs with location pin and countdown timer.' },
  { id: 'gala', name: 'Milestone Gala / Anniversary', desc: 'Galas, 30th/50th/75th birthdays, corporate events & vow renewals.' },
  { id: 'dinner', name: 'Intimate Dinner / Cocktail Mixer', desc: 'Short duration, single-focus dining or social mixers.' },
  { id: 'other', name: 'Workshops / Other Event', desc: 'Pop-up experiences, workshops, and custom gatherings.' },
];

const EVENT_TIER_MAP: Record<string, string> = {
  wedding: 'opulent',
  memorial: 'prelude',
  kids: 'prelude',
  gala: 'signature',
  dinner: 'prelude',
  other: 'prelude',
};

const EVENT_PACKAGES: Record<string, PackageDef> = {
  prelude: {
    name: 'The Prelude Canvas',
    basePrice: 150,
    subText:
      'Designed for intimate, short-duration, or single-focus events that require clean functionality without high multi-page complexity.',
    inclusions: [
      'Host Details & Custom Event Naming',
      'Live Countdown Timer',
      'Interactive Venue Map & Directions Pin',
      'Direct RSVP Form & Attendance Tracking',
      'Dress Code & Color Suggestions',
      'Respectful Order of Service & Venue Essentials',
    ],
    addons: [
      { id: 'lumora-echo-addon', name: 'LUMORA Echo Audiobook', price: 100, desc: 'Add gentle background music and personal voice messages from loved ones.' },
      { id: 'rsvp-manager', name: 'RSVP Guest Dashboard', price: 80, desc: 'Easily track guest responses, meal choices, and dietary notes in real time.' },
      { id: 'gift-registry', name: 'Gift Registry Links', price: 40, desc: 'Simple links for wishlist items or gift contributions.' },
    ],
  },
  signature: {
    name: 'The Signature Impression',
    basePrice: 320,
    subText:
      'Designed for milestone events that require multi-section narratives, richer guest management, schedules, and visual galleries.',
    inclusions: [
      'Host Information & Custom Event Naming',
      'Live Countdown Timer',
      'Interactive Venue Map & Directions',
      'RSVP Form & Calendar Integration',
      'Dress Code & Color Palette Guide',
      'Venue Essentials (Wi-Fi, Valet, Restrooms, etc.)',
      'Venue & Photo Showcase Gallery',
      'Animated Day-of Schedule & Itinerary',
      'Guest FAQs & Management Dashboard',
    ],
    addons: [
      { id: 'lumora-echo-addon', name: 'LUMORA Echo Audiobook', price: 100, desc: 'Add gentle background music and personal voice messages from loved ones.' },
      { id: 'gift-registry', name: 'Gift Registry Links', price: 40, desc: 'Simple links for wishlist items or gift contributions.' },
    ],
  },
  opulent: {
    name: 'The Opulent Horizon',
    basePrice: 450,
    subText:
      'Designed for high-touch, multi-day, complex, or luxury celebrations that require complete concierge-style features, travel guides, and bespoke story suites.',
    inclusions: [
      'Host Information & Custom Multi-Event Naming',
      'Live Countdown Timer',
      'Interactive Venue Maps & Accommodations Travel Guide',
      'Concierge-Style Multi-Day RSVP & Attendance Suite',
      'Bespoke Dress Code & Color Palette Guide',
      'Complete Venue Essentials & Travel Accommodations Links',
      'High-Resolution Visual Media & Story Galleries',
      'Multi-Day Animated Schedule (Welcome Dinner, Ceremony, Farewell Brunch)',
      'Gift & Cash Registry Integration',
      'Comprehensive Guest FAQs & Concierge Dashboard',
    ],
    addons: [
      { id: 'lumora-echo-addon', name: 'LUMORA Echo Audiobook', price: 100, desc: 'Add gentle background music and personal voice messages from loved ones.' },
      { id: 'how-we-met', name: 'Bespoke Journey / Story Timeline', price: 60, desc: 'A beautifully animated timeline sharing the special moments of your story together.' },
    ],
  },
  echo1: {
    name: 'Echo Essential',
    basePrice: 60,
    subText: 'A simple, beautiful audio keepsake featuring a single voice message and music.',
    inclusions: [
      '1 Voice Recording or Audio Upload',
      '30 to 60-Second Audio Length',
      'Crystal-Clear Audio Noise Cancellation',
      'Your Choice of Background Music',
    ],
    addons: [],
  },
  echo2: {
    name: 'Echo Classic',
    basePrice: 140,
    subText: 'A richer audio collection capturing voices and messages from family and friends.',
    inclusions: [
      'Up to 10 Audio Clips',
      'Up to 30 Seconds Per Clip',
      'Crystal-Clear Audio Noise Cancellation',
      'Your Choice of Background Music',
    ],
    addons: [
      { id: 'echo2-extra-audios', name: 'Expand to 20 Additional Voice Clips', price: 30, desc: 'Add extra space for up to 20 additional messages from guests.' },
      { id: 'echo2-signatures', name: 'Digital Guestbook Signatures (Up to 30)', price: 20, desc: 'Allows up to 30 guests to leave handwritten or drawn signatures online.' },
    ],
  },
  echo3: {
    name: 'Echo Treasury',
    basePrice: 190,
    subText: 'Our most complete audio guestbook to preserve an entire celebration of voices.',
    inclusions: [
      'Up to 100 Audio Clips',
      'Up to 30 Seconds Per Clip',
      'Crystal-Clear Audio Noise Cancellation',
      'Your Choice of Background Music',
    ],
    addons: [
      { id: 'echo3-extra-audios', name: 'Expand to 50 Additional Voice Clips', price: 50, desc: 'Add extra space for up to 50 additional messages from guests.' },
      { id: 'echo3-signatures', name: 'Digital Guestbook Signatures (Up to 150)', price: 30, desc: 'Allows up to 150 guests to leave handwritten or drawn signatures online.' },
    ],
  },
};

const FORM_SCHEMAS: Record<string, FormRowDef[]> = {
  prelude: [
    {
      accordion: 1,
      grid: [
        { id: 'primary-name', label: 'Host Name(s)', type: 'text', placeholder: 'Julian Vance', required: true },
        { id: 'primary-email', label: 'Email Address', type: 'email', placeholder: 'hello@lumora.studio', required: true },
      ],
    },
    {
      accordion: 1,
      grid: [{ id: 'contact-number', label: 'Phone Number', type: 'phone', required: true }],
    },
    {
      accordion: 1,
      fields: [
        { id: 'event-title', label: 'Event Title (as on invitation)', type: 'text', placeholder: 'In Loving Memory of Arthur Vance / An Evening of Fine Dining', required: true },
      ],
    },
    {
      accordion: 1,
      grid: [
        { id: 'event-date', label: 'Event Date', type: 'date', required: true },
        { id: 'venue-name', label: 'Venue / Host Location Name', type: 'text', placeholder: "St. Patrick's Cathedral / The Cliff Restaurant", required: true },
      ],
    },
    {
      accordion: 1,
      grid: [
        { id: 'venue-address', label: 'Venue Address', type: 'text', placeholder: 'Bay Street, Bridgetown', required: true },
        {
          id: 'location-format-select',
          label: 'How would you like to share the location?',
          type: 'select',
          required: true,
          options: [
            { value: 'link', text: 'Google Maps Link' },
            { value: 'coords', text: 'Use My Current Location' },
          ],
        },
      ],
    },
    {
      accordion: 1,
      grid: [
        { id: 'location-dynamic-input-group', label: 'Google Maps Link', type: 'location-interactive' },
        {
          id: 'venue-comforts',
          label: 'Guest Amenities at Venue',
          type: 'checkbox-group',
          options: [
            { value: 'wifi', label: 'Wi-Fi Available' },
            { value: 'parking', label: 'Parking / Valet' },
            { value: 'bathrooms', label: 'Restrooms' },
          ],
        },
      ],
    },
    {
      accordion: 1,
      grid: [{ id: 'other-comforts', label: 'Additional Guest Notes', type: 'text', placeholder: 'e.g., Order of Service details or parking notes' }],
    },
    {
      accordion: 2,
      fields: [{ id: 'color-palette-hexes', label: 'Select Your Event Color Palette', type: 'palette-capture', required: true }],
    },
    {
      accordion: 2,
      fields: [{ id: 'itinerary-notes', label: 'Share Your Event Order of Service / Schedule', type: 'textarea', placeholder: 'Gathering at 2:00 PM, Service at 3:00 PM...' }],
    },
    {
      accordion: 3,
      grid: [
        { id: 'venue-images', label: 'Upload Photos or Keepsake Images', type: 'file', multiple: true, accept: 'image/*' },
        { id: 'gift-registry', label: 'Optional Wishlist or Contribution Links', type: 'text', placeholder: 'e.g., Memorial fund or wishlist link' },
      ],
    },
  ],
  signature: [
    {
      accordion: 1,
      grid: [
        { id: 'primary-name', label: 'Organizer / Host Name(s)', type: 'text', placeholder: 'Julian Vance', required: true },
        { id: 'primary-email', label: 'Contact Email Address', type: 'email', placeholder: 'hello@lumora.studio', required: true },
      ],
    },
    {
      accordion: 1,
      grid: [{ id: 'contact-number', label: 'Contact Phone Number', type: 'phone', required: true }],
    },
    {
      accordion: 1,
      fields: [
        { id: 'gala-title', label: 'Official Event Title (as on invitation)', type: 'text', placeholder: "Julian's 50th Birthday Gala / Annual Leadership Summit", required: true },
      ],
    },
    {
      accordion: 1,
      grid: [
        { id: 'event-date', label: 'Event Date', type: 'date', required: true },
        { id: 'venue-name', label: 'Venue Name', type: 'text', placeholder: 'Hilton Barbados Resort', required: true },
      ],
    },
    {
      accordion: 1,
      grid: [
        { id: 'venue-address', label: 'Venue Address', type: 'text', placeholder: 'Needhams Point, St. Michael', required: true },
        {
          id: 'location-format-select',
          label: 'How would you like to share the location?',
          type: 'select',
          required: true,
          options: [
            { value: 'link', text: 'Google Maps Link' },
            { value: 'coords', text: 'Use My Current Location' },
          ],
        },
      ],
    },
    {
      accordion: 1,
      grid: [
        { id: 'location-dynamic-input-group', label: 'Google Maps Link', type: 'location-interactive' },
        {
          id: 'venue-comforts',
          label: 'Venue Essentials & Amenities',
          type: 'checkbox-group',
          options: [
            { value: 'wifi', label: 'High-Speed Wi-Fi' },
            { value: 'parking', label: 'Valet / Parking' },
            { value: 'bathrooms', label: 'Restrooms' },
          ],
        },
      ],
    },
    {
      accordion: 1,
      grid: [{ id: 'other-comforts', label: 'Additional Attendee Notes', type: 'text', placeholder: 'e.g., Black tie dress code' }],
    },
    {
      accordion: 2,
      fields: [{ id: 'color-palette-hexes', label: 'Select Brand / Event Color Palette', type: 'palette-capture', required: true }],
    },
    {
      accordion: 2,
      fields: [{ id: 'itinerary-notes', label: 'Share Event Agenda & Schedule', type: 'textarea', placeholder: '6:00 PM Keynote Address, 7:30 PM Gala Dinner...' }],
    },
    {
      accordion: 3,
      grid: [
        { id: 'venue-images', label: 'Upload Gallery Media', type: 'file', multiple: true, accept: 'image/*' },
        { id: 'gift-registry', label: 'Registry or Event Links', type: 'text', placeholder: 'e.g., https://lumora.studio/gala-info' },
      ],
    },
  ],
  opulent: [
    {
      accordion: 1,
      grid: [
        { id: 'primary-name', label: 'Your Full Name(s)', type: 'text', placeholder: 'Alexander & Julian', required: true },
        { id: 'primary-email', label: 'Email Address', type: 'email', placeholder: 'hello@lumora.studio', required: true },
      ],
    },
    {
      accordion: 1,
      grid: [{ id: 'contact-number', label: 'Phone Number', type: 'phone', required: true }],
    },
    {
      accordion: 1,
      fields: [
        { id: 'couple-family-name', label: 'Title / Names to Display (as on invitation)', type: 'text', placeholder: "Alexander & Julian's Wedding Weekend", required: true },
      ],
    },
    {
      accordion: 1,
      grid: [
        { id: 'event-date', label: 'Celebration Start Date', type: 'date', required: true },
        { id: 'venue-name', label: 'Primary Venue Name', type: 'text', placeholder: 'Cobblers Cove Hotel', required: true },
      ],
    },
    {
      accordion: 1,
      grid: [
        { id: 'venue-address', label: 'Venue Address', type: 'text', placeholder: 'Road View, Speightstown, St. Peter', required: true },
        {
          id: 'location-format-select',
          label: 'How would you like to share the location?',
          type: 'select',
          required: true,
          options: [
            { value: 'link', text: 'Google Maps Link' },
            { value: 'coords', text: 'Use My Current Location' },
          ],
        },
      ],
    },
    {
      accordion: 1,
      grid: [
        { id: 'location-dynamic-input-group', label: 'Google Maps Link', type: 'location-interactive' },
        {
          id: 'venue-comforts',
          label: 'Guest Amenities at Venue',
          type: 'checkbox-group',
          options: [
            { value: 'wifi', label: 'Wi-Fi Available' },
            { value: 'parking', label: 'Parking / Valet' },
            { value: 'bathrooms', label: 'Restrooms' },
          ],
        },
      ],
    },
    {
      accordion: 1,
      grid: [{ id: 'other-comforts', label: 'Travel & Accommodation Notes', type: 'text', placeholder: 'e.g., Hotel room block booking links and airport shuttle info' }],
    },
    {
      accordion: 2,
      fields: [{ id: 'color-palette-hexes', label: 'Select Your Event Color Palette', type: 'palette-capture', required: true }],
    },
    {
      accordion: 2,
      fields: [{ id: 'itinerary-notes', label: 'Share Your Multi-Day Schedule', type: 'textarea', placeholder: 'Friday Welcome Dinner at 6:00 PM, Saturday Ceremony at 4:00 PM...' }],
    },
    {
      accordion: 3,
      grid: [
        { id: 'venue-images', label: 'Upload Venue & Gallery Photos', type: 'file', multiple: true, accept: 'image/*' },
        { id: 'gift-registry', label: 'Registry Links or Store Names', type: 'text', placeholder: 'e.g., https://zola.com/registry/vance', required: true },
      ],
    },
  ],
  echo1: [
    {
      accordion: 1,
      grid: [
        { id: 'primary-name', label: 'Your Full Name', type: 'text', placeholder: 'Julian Vance', required: true },
        { id: 'primary-email', label: 'Email Address', type: 'email', placeholder: 'hello@lumora.studio', required: true },
      ],
    },
    { accordion: 1, grid: [{ id: 'contact-number', label: 'Phone Number', type: 'phone', required: true }] },
    { accordion: 1, fields: [{ id: 'echo-honoree', label: 'Honoree Name(s) / Event Title', type: 'text', placeholder: "For Julian's 30th Birthday Celebration", required: true }] },
    { accordion: 1, grid: [{ id: 'event-date', label: 'Event / Delivery Date', type: 'date', required: true }] },
    { accordion: 2, fields: [{ id: 'music-choice', label: 'Preferred Background Music Style', type: 'text', placeholder: 'Gentle acoustic guitar, ambient piano, instrumental jazz...', required: true }] },
    { accordion: 3, fields: [{ id: 'echo-cloud-hub', label: 'Audio Upload & Voice Recording Station', type: 'echo-cloud-hub' }] },
  ],
  echo2: [
    {
      accordion: 1,
      grid: [
        { id: 'primary-name', label: 'Your Full Name', type: 'text', placeholder: 'Julian Vance', required: true },
        { id: 'primary-email', label: 'Email Address', type: 'email', placeholder: 'hello@lumora.studio', required: true },
      ],
    },
    { accordion: 1, grid: [{ id: 'contact-number', label: 'Phone Number', type: 'phone', required: true }] },
    { accordion: 1, fields: [{ id: 'echo-honoree', label: 'Honoree Name(s) / Event Title', type: 'text', placeholder: "For Elena & Marcus's Wedding", required: true }] },
    { accordion: 1, grid: [{ id: 'event-date', label: 'Event / Delivery Date', type: 'date', required: true }] },
    { accordion: 2, fields: [{ id: 'music-choice', label: 'Preferred Background Music Style', type: 'text', placeholder: 'Classical strings, soft ambient piano...', required: true }] },
    { accordion: 3, fields: [{ id: 'echo-cloud-hub', label: 'Audio Upload & Voice Recording Station', type: 'echo-cloud-hub' }] },
  ],
  echo3: [
    {
      accordion: 1,
      grid: [
        { id: 'primary-name', label: 'Your Full Name', type: 'text', placeholder: 'Julian Vance', required: true },
        { id: 'primary-email', label: 'Email Address', type: 'email', placeholder: 'hello@lumora.studio', required: true },
      ],
    },
    { accordion: 1, grid: [{ id: 'contact-number', label: 'Phone Number', type: 'phone', required: true }] },
    { accordion: 1, fields: [{ id: 'echo-honoree', label: 'Honoree Name(s) / Event Title', type: 'text', placeholder: 'The Grand Jubilee Celebration', required: true }] },
    { accordion: 1, grid: [{ id: 'event-date', label: 'Event / Delivery Date', type: 'date', required: true }] },
    { accordion: 2, fields: [{ id: 'music-choice', label: 'Preferred Background Music Style', type: 'text', placeholder: 'Cinematic orchestral, ambient harp...', required: true }] },
    { accordion: 3, fields: [{ id: 'echo-cloud-hub', label: 'Audio Upload & Voice Recording Station', type: 'echo-cloud-hub' }] },
  ],
};

export default function StorefrontClient() {
  const [activeCurrency, setActiveCurrency] = useState<'BBD' | 'USD'>('BBD');
  const [isLightMode, setIsLightMode] = useState(false);

  const [barbadosClock, setBarbadosClock] = useState('00:00:00 AM');
  const [studioOpen, setStudioOpen] = useState(false);

  const [selectionModalOpen, setSelectionModalOpen] = useState(false);
  const [activeProductContext, setActiveProductContext] = useState<'canvas' | 'echo'>('canvas');
  const [onboardingStep, setOnboardingStep] = useState<1 | 2>(1);
  const [selectedEventType, setSelectedEventType] = useState<string | null>(null);

  const [intakeActive, setIntakeActive] = useState(false);
  const [selectedPackageKey, setSelectedPackageKey] = useState<string>('prelude');
  const [openAccordions, setOpenAccordions] = useState<Record<number, boolean>>({ 1: true, 2: false, 3: false, 4: false });
  const [selectedAddons, setSelectedAddons] = useState<Record<string, boolean>>({});
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [phoneCode, setPhoneCode] = useState('+1246');
  const [selectedAmenities, setSelectedAmenities] = useState<Record<string, boolean>>({});
  const [locationFormat, setLocationFormat] = useState<'link' | 'coords'>('link');
  const [capturedCoords, setCapturedCoords] = useState('');
  const [paletteColors, setPaletteColors] = useState<string[]>(['#2F172C', '#F6F2EA', '#8FA89B']);
  const [uploadedMediaNames, setUploadedMediaNames] = useState<string[]>([]);
  const [uploadedAudioQueue, setUploadedAudioQueue] = useState<{ name: string; url: string }[]>([]);

  const [isRecording, setIsRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const [paymentRevealed, setPaymentRevealed] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentGateway>('cibc');
  const [cardholderName, setCardholderName] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [cardZip, setCardZip] = useState('');
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [paymentToast, setPaymentToast] = useState<string | null>(null);

  const [portalModalOpen, setPortalModalOpen] = useState(false);
  const [portalChannel, setPortalChannel] = useState<'email' | 'whatsapp'>('email');
  const [portalEmailInput, setPortalEmailInput] = useState('');
  const [portalCountryCode, setPortalCountryCode] = useState('+1246');
  const [portalWhatsappInput, setPortalWhatsappInput] = useState('');
  const [portalStatusNotice, setPortalStatusNotice] = useState<string | null>(null);
  const [activePortalOrder, setActivePortalOrder] = useState<LumoraOrder | null>(null);
  const [portalReplyText, setPortalReplyText] = useState('');

  useEffect(() => {
    const t1 = setTimeout(() => document.body.classList.add('brand-emerged'), 200);
    const t2 = setTimeout(() => document.body.classList.add('tagline-revealed'), 1000);
    const t3 = setTimeout(() => {
      document.body.classList.add('deck-revealed');
      document.body.classList.add('breath-active');
    }, 1800);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      document.body.classList.remove('brand-emerged', 'tagline-revealed', 'deck-revealed', 'breath-active', 'intake-active');
    };
  }, []);

  useEffect(() => {
    if (intakeActive) {
      document.body.classList.add('intake-active');
    } else {
      document.body.classList.remove('intake-active');
    }
  }, [intakeActive]);

  useEffect(() => {
    if (isLightMode) {
      document.body.classList.add('light-mode');
    } else {
      document.body.classList.remove('light-mode');
    }
  }, [isLightMode]);

  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setBarbadosClock(
        new Intl.DateTimeFormat('en-US', {
          timeZone: 'America/Barbados',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true,
        }).format(now)
      );
      const currentDay = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/Barbados',
        weekday: 'short',
      }).format(now);
      const currentHour = parseInt(
        new Intl.DateTimeFormat('en-US', {
          timeZone: 'America/Barbados',
          hour: 'numeric',
          hour12: false,
        }).format(now),
        10
      );
      let open = false;
      if (['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].includes(currentDay)) {
        if (currentHour >= 9 && currentHour < 16) open = true;
      } else if (currentDay === 'Sat') {
        if (currentHour >= 10 && currentHour < 14) open = true;
      }
      setStudioOpen(open);
    };
    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!isRecording) return;
    const interval = setInterval(() => setRecordSeconds((s) => s + 1), 1000);
    return () => clearInterval(interval);
  }, [isRecording]);

  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if ((e.key === DB_STORAGE_KEY || e.key === BOOKINGS_STORAGE_KEY) && activePortalOrder) {
        const db = getDatabase();
        const refreshed = db.orders.find((o) => o.id === activePortalOrder.id) || null;
        setActivePortalOrder(refreshed);
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [activePortalOrder]);

  const formatPriceValue = (usdAmount: number, formatType: 'modal' | 'addon' | 'summary' | 'standard' = 'standard') => {
    const numericValue = activeCurrency === 'BBD' ? usdAmount * USD_TO_BBD_RATE : usdAmount;
    if (formatType === 'modal') {
      return activeCurrency === 'BBD' ? `$${Math.round(numericValue)} BBD` : `$${Math.round(numericValue)} US`;
    } else if (formatType === 'addon') {
      return activeCurrency === 'BBD' ? `+$${Math.round(numericValue)} BBD` : `+$${Math.round(numericValue)} US`;
    } else if (formatType === 'summary') {
      return activeCurrency === 'BBD' ? `$${numericValue.toFixed(2)} BBD` : `$${numericValue.toFixed(2)} US`;
    }
    return `$${numericValue.toFixed(2)}`;
  };

  const openSelectionModal = (productType: 'canvas' | 'echo') => {
    setActiveProductContext(productType);
    setOnboardingStep(1);
    setSelectedEventType(null);
    setSelectionModalOpen(true);
  };

  const selectEventIntent = (intentId: string) => {
    setSelectedEventType(intentId);
    setOnboardingStep(2);
  };

  const confirmTierSelection = (packageKey: string) => {
    setSelectionModalOpen(false);
    setSelectedPackageKey(packageKey);
    setSelectedAddons({});
    setUploadedAudioQueue([]);
    setUploadedMediaNames([]);
    setCapturedCoords('');
    setLocationFormat('link');
    setPaymentRevealed(false);
    setPaymentToast(null);
    setOpenAccordions({ 1: true, 2: false, 3: false, 4: false });
    setIntakeActive(true);
  };

  const captureCurrentLocation = () => {
    if (!navigator.geolocation) {
      setCapturedCoords('Geolocation not supported by browser');
      return;
    }
    setCapturedCoords('Locating...');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCapturedCoords(`${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)}`);
      },
      () => {
        setCapturedCoords('Unable to retrieve location');
      }
    );
  };

  const toggleAudioRecording = () => {
    if (!isRecording) {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        alert('Audio recording is not supported in this browser.');
        return;
      }
      navigator.mediaDevices
        .getUserMedia({ audio: true })
        .then((stream) => {
          const recorder = new MediaRecorder(stream);
          mediaRecorderRef.current = recorder;
          audioChunksRef.current = [];
          recorder.ondataavailable = (e) => audioChunksRef.current.push(e.data);
          recorder.onstop = () => {
            const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
            setUploadedAudioQueue((prev) => [
              ...prev,
              { name: `Voice Recording #${prev.length + 1}`, url: URL.createObjectURL(blob) },
            ]);
          };
          recorder.start();
          setRecordSeconds(0);
          setIsRecording(true);
        })
        .catch(() => alert('Microphone access denied or unavailable.'));
    } else {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
        mediaRecorderRef.current.stream.getTracks().forEach((t) => t.stop());
      }
      setIsRecording(false);
    }
  };

  const currentPackage = EVENT_PACKAGES[selectedPackageKey] || EVENT_PACKAGES.prelude;
  const activeAddonsList = currentPackage.addons.filter((a) => selectedAddons[a.id]);
  const addonsTotalUsd = activeAddonsList.reduce((sum, a) => sum + a.price, 0);
  const grandTotalUsd = currentPackage.basePrice + addonsTotalUsd;
  const depositUsd = grandTotalUsd * 0.5;
  const depositBbd = depositUsd * USD_TO_BBD_RATE;

  const handleRevealPaymentForm = (e: React.FormEvent) => {
    e.preventDefault();
    setPaymentRevealed(true);
    setTimeout(() => {
      document.getElementById('terminal-wrapper')?.scrollIntoView({ behavior: 'smooth' });
    }, 80);
  };

  const handleProcessLiveDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessingPayment(true);

    const db = getDatabase();
    const newOrderId = `ORD-2026-${1001 + db.orders.length}`;
    const clientEmail = (formValues['primary-email'] || 'client@lumora.studio').trim();

    const paymentPayload = {
      amountBbd: depositBbd,
      amountUsd: depositUsd,
      orderId: newOrderId,
      clientEmail,
    };

    let paymentResult;
    if (selectedPaymentMethod === 'cibc') {
      paymentResult = await processCibcPayment(paymentPayload);
    } else if (selectedPaymentMethod === 'bimpay') {
      paymentResult = await processBimpayPayment(paymentPayload);
    } else if (selectedPaymentMethod === 'mmoney') {
      paymentResult = await processMmoneyPayment(paymentPayload);
    } else {
      paymentResult = await processWalletPayment(paymentPayload);
    }

    setPaymentToast(paymentResult.message);

    setTimeout(() => {
      const clientName = (formValues['primary-name'] || 'Valued Client').trim();
      const rawPhone = (formValues['contact-number'] || '').trim();
      const clientPhone = rawPhone ? `${phoneCode} ${rawPhone}` : '';
      const eventTitle =
        (formValues['event-title'] ||
          formValues['gala-title'] ||
          formValues['couple-family-name'] ||
          formValues['echo-honoree'] ||
          currentPackage.name).trim();
      const eventDate = formValues['event-date'] || 'TBD';

      const amenitiesLabels = Object.entries(selectedAmenities)
        .filter(([, checked]) => checked)
        .map(([label]) => label);

      const locationValue =
        locationFormat === 'coords'
          ? capturedCoords || 'Coordinates not captured'
          : (formValues['venue-google-map-link'] || '').trim();

      const newOrder: LumoraOrder = {
        id: newOrderId,
        clientName,
        email: clientEmail,
        phone: clientPhone,
        packageKey: selectedPackageKey,
        packageName: currentPackage.name,
        eventTitle,
        eventDate,
        totalUsd: grandTotalUsd,
        depositPaidUsd: depositUsd,
        finalSettled: false,
        status: 'submitted',
        paymentProvider: paymentResult.provider,
        paymentReference: paymentResult.reference,
        draftApproval: { status: 'pending' },
        intakeSpecs: {
          eventIntent: selectedEventType || selectedPackageKey,
          venueName: (formValues['venue-name'] || '').trim(),
          venueAddress: (formValues['venue-address'] || '').trim(),
          locationFormat,
          locationValue,
          amenities: amenitiesLabels,
          guestNotes: (formValues['other-comforts'] || '').trim(),
          colorPalette: paletteColors,
          itineraryNotes: (formValues['itinerary-notes'] || '').trim(),
          musicChoice: (formValues['music-choice'] || '').trim(),
          giftRegistry: (formValues['gift-registry'] || '').trim(),
          selectedAddons: activeAddonsList.map((a) => ({
            id: a.id,
            name: a.name,
            priceUsd: a.price,
          })),
          uploadedMediaNames,
          uploadedAudioNames: uploadedAudioQueue.map((a) => a.name),
        },
        createdAt: new Date().toISOString(),
        messages: [],
        deliverables: [],
      };

      db.orders.unshift(newOrder);
      saveDatabase(db);

      setIsProcessingPayment(false);
      setPaymentRevealed(false);
      setIntakeActive(false);
    }, 1400);
  };

  const handlePortalAccessRequest = (e: React.FormEvent) => {
    e.preventDefault();
    const db = getDatabase();
    let matched: LumoraOrder | undefined;

    if (portalChannel === 'email') {
      const email = portalEmailInput.trim().toLowerCase();
      matched = db.orders.find((o) => o.email && o.email.toLowerCase() === email);
    } else {
      const digits = portalWhatsappInput.replace(/\D/g, '');
      matched = db.orders.find((o) => o.phone && o.phone.replace(/\D/g, '').includes(digits) && digits.length >= 4);
    }

    if (!matched) {
      setActivePortalOrder(null);
      setPortalStatusNotice(
        'No active commission found for those credentials. Place an order or open Atelier Admin first to preview sample commissions.'
      );
      return;
    }

    setPortalStatusNotice(null);
    setActivePortalOrder(matched);
  };

  const sendPortalClientMessage = () => {
    if (!activePortalOrder || !portalReplyText.trim()) return;
    const db = getDatabase();
    const order = db.orders.find((o) => o.id === activePortalOrder.id);
    if (!order) return;

    order.messages = order.messages || [];
    order.messages.push({
      sender: order.clientName || 'Client',
      text: portalReplyText.trim(),
      timestamp: new Date().toISOString(),
    });
    order.hasUnreadClientReply = true;
    saveDatabase(db);
    setPortalReplyText('');
    setActivePortalOrder({ ...order });
  };

  const submitDraftApproval = (decision: 'approved' | 'revisions_requested') => {
    if (!activePortalOrder) return;
    const db = getDatabase();
    const order = db.orders.find((o) => o.id === activePortalOrder.id);
    if (!order) return;

    const noteText = portalReplyText.trim();
    order.draftApproval = {
      status: decision,
      note: noteText,
      updatedAt: new Date().toISOString(),
    };
    order.messages = order.messages || [];
    if (decision === 'approved') {
      order.status = 'completed';
      order.messages.push({
        sender: order.clientName || 'Client',
        text: noteText ? `✓ Draft Approved: ${noteText}` : '✓ Draft Approved for final delivery.',
        timestamp: new Date().toISOString(),
      });
    } else {
      order.status = 'in_progress';
      order.messages.push({
        sender: order.clientName || 'Client',
        text: noteText ? `✎ Revision Request: ${noteText}` : '✎ Client requested revisions on the current draft.',
        timestamp: new Date().toISOString(),
      });
    }
    order.hasUnreadClientReply = true;
    saveDatabase(db);
    setPortalReplyText('');
    setActivePortalOrder({ ...order });
  };

  const handleCardMouseMove = (e: React.MouseEvent<HTMLElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty('--mouse-x', `${e.clientX - rect.left}px`);
    e.currentTarget.style.setProperty('--mouse-y', `${e.clientY - rect.top}px`);
  };

  const renderField = (field: FormFieldDef) => {
    const mapFieldId = `venue-google-map-link-${field.id}`;

    return (
      <div className="luxury-group" key={field.id} id={field.type === 'location-interactive' ? 'interactive-location-container' : undefined}>
        <label className="luxury-label" htmlFor={field.type === 'location-interactive' ? mapFieldId : field.id}>
          {field.label}
        </label>

        {(field.type === 'text' || field.type === 'email' || field.type === 'date' || field.type === 'url') && (
          <input
            type={field.type}
            id={field.id}
            className="luxury-input"
            placeholder={field.placeholder}
            required={field.required}
            value={formValues[field.id] || ''}
            onChange={(e) => setFormValues((prev) => ({ ...prev, [field.id]: e.target.value }))}
          />
        )}

        {field.type === 'textarea' && (
          <textarea
            id={field.id}
            className="luxury-textarea"
            placeholder={field.placeholder}
            value={formValues[field.id] || ''}
            onChange={(e) => setFormValues((prev) => ({ ...prev, [field.id]: e.target.value }))}
          />
        )}

        {field.type === 'select' && (
          <div className="luxury-select-wrapper">
            <select
              id={field.id}
              className="luxury-select"
              value={locationFormat}
              onChange={(e) => setLocationFormat(e.target.value as 'link' | 'coords')}
            >
              {field.options?.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.text}
                </option>
              ))}
            </select>
          </div>
        )}

        {field.type === 'checkbox-group' && (
          <div className="luxury-checkbox-grid">
            {field.options?.map((opt) => {
              const labelText = opt.label || opt.value;
              return (
                <label className="luxury-checkbox-item" key={opt.value}>
                  <input
                    type="checkbox"
                    name={field.id}
                    value={opt.value}
                    checked={!!selectedAmenities[labelText]}
                    onChange={(e) =>
                      setSelectedAmenities((prev) => ({ ...prev, [labelText]: e.target.checked }))
                    }
                  />
                  {labelText}
                </label>
              );
            })}
          </div>
        )}

        {field.type === 'phone' && (
          <div className="phone-input-grid">
            <div className="luxury-select-wrapper">
              <select
                id={`${field.id}-code`}
                className="luxury-select"
                aria-label="Country Code"
                value={phoneCode}
                onChange={(e) => setPhoneCode(e.target.value)}
              >
                <option value="+1246">+1 (246) BB</option>
                <option value="+1">+1 (US/CA)</option>
                <option value="+44">+44 (UK)</option>
              </select>
            </div>
            <input
              type="tel"
              id={field.id}
              className="luxury-input"
              placeholder="842-5133"
              required={field.required}
              value={formValues[field.id] || ''}
              onChange={(e) => setFormValues((prev) => ({ ...prev, [field.id]: e.target.value }))}
            />
          </div>
        )}

        {field.type === 'file' && (
          <div className="luxury-file-input-wrapper">
            <label className="luxury-file-label" id={`label-${field.id}`} htmlFor={field.id}>
              {uploadedMediaNames.length > 0
                ? `${uploadedMediaNames.length} file(s) selected`
                : 'Click or Drag Files Here to Upload'}
            </label>
            <input
              type="file"
              id={field.id}
              className="luxury-file-input"
              multiple={field.multiple}
              accept={field.accept || '*'}
              onChange={(e) => {
                const files = e.target.files ? Array.from(e.target.files).map((f) => f.name) : [];
                setUploadedMediaNames(files);
              }}
            />
          </div>
        )}

        {field.type === 'echo-cloud-hub' && (
          <div className="cloud-submission-hub">
            <div className="cloud-hub-header">
              <span className="cloud-hub-title">Audio Message Recording &amp; Upload Hub</span>
              <span className="cloud-hub-desc">
                Record a voice message directly in your browser or upload pre-recorded audio files.
              </span>
            </div>
            <div className="audio-controls-container">
              <button
                type="button"
                id="record-audio-btn"
                className={`audio-btn ${isRecording ? 'recording' : ''}`}
                onClick={toggleAudioRecording}
              >
                {isRecording ? 'Stop Recording' : 'Start Recording'}
              </button>
              <span id="record-timer" className="audio-status-timer">
                {`${String(Math.floor(recordSeconds / 60)).padStart(2, '0')}:${String(recordSeconds % 60).padStart(2, '0')}`}
              </span>
            </div>
            <div className="luxury-file-input-wrapper">
              <label className="luxury-file-label" htmlFor="echo-audio-upload">
                + Upload Audio Files (MP3, WAV, M4A)
              </label>
              <input
                type="file"
                id="echo-audio-upload"
                className="luxury-file-input"
                accept="audio/*"
                multiple
                onChange={(e) => {
                  const files = e.target.files ? Array.from(e.target.files) : [];
                  setUploadedAudioQueue((prev) => [
                    ...prev,
                    ...files.map((f) => ({ name: f.name, url: URL.createObjectURL(f) })),
                  ]);
                }}
              />
            </div>
            <div id="audio-queue-container" className="audio-queue-list">
              {uploadedAudioQueue.map((item, idx) => (
                <div className="audio-queue-item" key={`${item.name}-${idx}`}>
                  <span>{item.name}</span>
                  <audio controls src={item.url} />
                  <button
                    type="button"
                    className="audio-remove-btn"
                    onClick={() =>
                      setUploadedAudioQueue((prev) => prev.filter((_, i) => i !== idx))
                    }
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {field.type === 'location-interactive' &&
          (locationFormat === 'coords' ? (
            <div className="coordinate-capture-container">
              <button type="button" className="coordinate-trigger-btn" onClick={captureCurrentLocation}>
                Capture Current Coordinates
              </button>
              <span id="coords-status-label" className="palette-selection-summary-text">
                {capturedCoords ? `Captured: ${capturedCoords}` : 'No location captured yet'}
              </span>
            </div>
          ) : (
            <input
              type="text"
              id={mapFieldId}
              className="luxury-input"
              placeholder="https://maps.google.com/?q=..."
              value={formValues['venue-google-map-link'] || ''}
              onChange={(e) =>
                setFormValues((prev) => ({ ...prev, 'venue-google-map-link': e.target.value }))
              }
            />
          ))}

        {field.type === 'palette-capture' && (
          <div className="palette-container">
            <div className="custom-palette-trigger">
              <div className="custom-palette-left">
                <span className="luxury-label">Custom Theme Palette</span>
                <span className="palette-selection-summary-text">
                  Click each circle to set Primary, Secondary, and Accent hex shades
                </span>
              </div>
              <div className="custom-palette-pickers">
                {paletteColors.map((hex, idx) => (
                  <div className="swatch-slot" key={idx}>
                    <div className="color-picker-input-wrapper" style={{ backgroundColor: hex }}>
                      <input
                        type="color"
                        className="color-picker-native"
                        value={hex}
                        onChange={(e) => {
                          const next = [...paletteColors];
                          next[idx] = e.target.value.toUpperCase();
                          setPaletteColors(next);
                        }}
                      />
                    </div>
                    <span className="swatch-hex-label">{hex}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const schemaRows = FORM_SCHEMAS[selectedPackageKey] || FORM_SCHEMAS.prelude;
  const recommendedTierKey = selectedEventType ? EVENT_TIER_MAP[selectedEventType] || 'prelude' : 'prelude';

  const currentPortalStageIdx = activePortalOrder
    ? Math.max(
        0,
        ORDER_TRACKING_STAGES.findIndex((s) => s.key === activePortalOrder.status)
      )
    : 0;
  const portalProgressPct = ((currentPortalStageIdx + 1) / ORDER_TRACKING_STAGES.length) * 100;

  return (
    <>
      <div className="noise-overlay" />

      {paymentToast && (
        <div
          style={{
            position: 'fixed',
            bottom: '2rem',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 5000,
            background: 'var(--summary-pane-bg)',
            border: '1px solid var(--text-light)',
            color: 'var(--text-light)',
            padding: '1rem 1.75rem',
            borderRadius: '30px',
            fontSize: '0.82rem',
            letterSpacing: '0.08em',
            boxShadow: '0 20px 50px rgba(0,0,0,0.6)',
          }}
        >
          {paymentToast}
        </div>
      )}

      <div className="header-controls-container">
        <button
          className="theme-controller"
          onClick={() => setActiveCurrency((prev) => (prev === 'BBD' ? 'USD' : 'BBD'))}
          aria-label="Toggle active currency"
        >
          <span className="currency-flag-badge" id="currency-flag-container">
            {activeCurrency === 'BBD' ? (
              <svg viewBox="0 0 600 400" xmlns="http://www.w3.org/2000/svg">
                <rect width="600" height="400" fill="#00267F" />
                <rect x="200" width="200" height="400" fill="#FFC72C" />
                <path
                  d="M 300 110 L 280 150 L 240 150 L 270 175 L 255 215 L 300 185 L 345 215 L 330 175 L 360 150 L 320 150 Z"
                  fill="#000000"
                />
                <rect x="290" y="210" width="20" height="80" fill="#000000" />
              </svg>
            ) : (
              <svg viewBox="0 0 741 390" xmlns="http://www.w3.org/2000/svg">
                <rect width="741" height="390" fill="#B22234" />
                <path d="M0 30h741M0 90h741M0 150h741M0 210h741M0 270h741M0 330h741" stroke="#FFF" strokeWidth="30" />
                <rect width="296.4" height="210" fill="#3C3B6E" />
              </svg>
            )}
          </span>
          <span className="theme-controller-text" id="currency-text">
            {activeCurrency === 'BBD' ? 'BBD $' : 'USD $'}
          </span>
        </button>

        <button
          className="theme-controller"
          onClick={() => setIsLightMode((prev) => !prev)}
          aria-label="Toggle visual theme"
        >
          <span className="theme-controller-text" id="theme-text">
            {isLightMode ? 'DARK MODE' : 'LIGHT MODE'}
          </span>
          <div className="theme-indicator-orb" />
        </button>
      </div>

      <div className="intro-spacer" />
      <header className="header-system">
        <h1 id="brand-logo">LUMORA</h1>
        <div className="tagline-wrapper">
          <span className="tagline-text">Smart. Interactive. Memorable.</span>
        </div>
      </header>

      <main id="main-portfolio">
        <div className="deck-wrapper">
          <section className="deck-container public-deck">
            <article
              className="deck-card"
              onMouseMove={handleCardMouseMove}
              onClick={() => openSelectionModal('canvas')}
            >
              <div className="card-top">
                <span className="card-num">01</span>
                <h3 className="card-title">LUMORA Canvas</h3>
                <p className="card-desc">
                  Bespoke digital keep-sakes and interactive event invitations crafted to celebrate life&apos;s most cherished milestones.
                </p>
              </div>
              <span className="card-action-trigger">Explore &amp; Begin →</span>
            </article>

            <article
              className="deck-card"
              onMouseMove={handleCardMouseMove}
              onClick={() => openSelectionModal('echo')}
            >
              <div className="card-top">
                <span className="card-num">02</span>
                <h3 className="card-title">LUMORA Echo</h3>
                <p className="card-desc">
                  Heartfelt, animated digital keepsakes blending voice messages, music, and imagery to share meaningful moments.
                </p>
              </div>
              <span className="card-action-trigger">Explore &amp; Begin →</span>
            </article>

            <article className="deck-card coming-soon-card" onMouseMove={handleCardMouseMove}>
              <div className="centered-coming-soon">Coming Soon</div>
            </article>
          </section>
        </div>

        <footer className="footer">
          <div className="footer-col">
            <span>LOCATION &amp; LOCAL TIME</span>
            <p>Bridgetown, Barbados</p>
            <div className="live-displays">
              <div className="status-wrapper">
                <div className={`status-dot ${studioOpen ? 'online' : 'offline'}`} id="live-dot" />
                <span id="live-status">{studioOpen ? 'Studio Open' : 'Studio Closed'}</span>
              </div>
              <div className="status-wrapper status-wrapper-muted">
                <span>AST Local:</span>
                <strong id="barbados-clock">{barbadosClock}</strong>
              </div>
              <div className="studio-hours">
                <span className="studio-hours-label">STUDIO HOURS</span>
                Mon – Fri: 9:00 AM – 4:00 PM
                <br />
                Sat: 10:00 AM – 2:00 PM
                <br />
                Sun: Closed
              </div>
            </div>
          </div>

          <div className="footer-col">
            <span>OUR PHILOSOPHY</span>
            <p>
              We craft digital keepsakes you&apos;ll cherish for years to come—holding safe the perfectly preserved moments, the legacies you built, and the love you shared, so you can remember exactly what it felt like to be there.
            </p>
          </div>

          <div className="footer-col">
            <span>CONNECT WITH US</span>
            <div className="footer-links-list">
              <a href="#" className="social-link">
                Instagram
              </a>
              <a href="https://wa.me/12468425133" target="_blank" className="social-link" rel="noopener noreferrer">
                WhatsApp Chat
              </a>
              <a href="tel:+12468425133" className="social-link">
                Call Us: +1 (246) 842-5133
              </a>
              <a href="mailto:info@lumora.studio" className="social-link">
                info@lumora.studio
              </a>
            </div>
          </div>
        </footer>

        <section className="portal-link-section">
          <Link href="/admin" className="portal-link-button">
            Atelier Admin →
          </Link>
          <button
            type="button"
            onClick={() => setPortalModalOpen(true)}
            className="portal-link-button"
          >
            Customer Portal →
          </button>
        </section>
      </main>

      <section
        className={`event-selection-overlay ${selectionModalOpen ? 'active' : ''}`}
        id="event-select-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <div className="selection-modal">
          <button
            type="button"
            className="modal-close-trigger return-home"
            onClick={() => setSelectionModalOpen(false)}
          >
            ← Return Home
          </button>
          <header className="selection-header">
            <h2 id="modal-title">
              {activeProductContext === 'echo'
                ? 'Choose Your LUMORA Echo Tier'
                : onboardingStep === 1
                ? 'What event are you hosting?'
                : 'Recommended Package Suite'}
            </h2>
            <p id="modal-subtitle">
              {activeProductContext === 'echo'
                ? 'Select an option below to explore features and customize your piece.'
                : onboardingStep === 1
                ? 'Select your event type to receive a tailored tier recommendation.'
                : `Based on your selection (${
                    EVENT_INTENT_OPTIONS.find((o) => o.id === selectedEventType)?.name || 'Hosting'
                  }), we've highlighted the recommended tier below. You may select any tier to continue.`}
            </p>
          </header>

          {activeProductContext === 'canvas' && onboardingStep === 1 && (
            <div className="selection-grid" id="modal-selection-grid-container">
              {EVENT_INTENT_OPTIONS.map((opt) => (
                <div key={opt.id} className="selection-card" onClick={() => selectEventIntent(opt.id)}>
                  <div className="selection-card-title">{opt.name}</div>
                  <p className="selection-card-desc">{opt.desc}</p>
                </div>
              ))}
            </div>
          )}

          {activeProductContext === 'canvas' && onboardingStep === 2 && (
            <div className="selection-grid tier-3-grid" id="modal-selection-grid-container">
              {(['prelude', 'signature', 'opulent'] as const).map((tierKey) => {
                const pkg = EVENT_PACKAGES[tierKey];
                const isRecommended = tierKey === recommendedTierKey;
                return (
                  <div
                    key={tierKey}
                    className={`selection-card ${isRecommended ? 'recommended-tier' : 'dimmed'}`}
                    onClick={() => confirmTierSelection(tierKey)}
                  >
                    {isRecommended && <span className="recommendation-badge">Highly Recommended</span>}
                    <div className="selection-card-title">
                      {pkg.name}
                      <span className="selection-card-badge">{formatPriceValue(pkg.basePrice, 'modal')}</span>
                    </div>
                    <p className="selection-card-desc">{pkg.subText}</p>
                    <div className="selection-card-price">Includes {pkg.inclusions.length} core features</div>
                  </div>
                );
              })}
            </div>
          )}

          {activeProductContext === 'echo' && (
            <div className="selection-grid tier-3-grid" id="modal-selection-grid-container">
              {(['echo1', 'echo2', 'echo3'] as const).map((tierKey) => {
                const pkg = EVENT_PACKAGES[tierKey];
                return (
                  <div key={tierKey} className="selection-card" onClick={() => confirmTierSelection(tierKey)}>
                    <div className="selection-card-title">
                      {pkg.name}
                      <span className="selection-card-badge">{formatPriceValue(pkg.basePrice, 'modal')}</span>
                    </div>
                    <p className="selection-card-desc">{pkg.subText}</p>
                    <div className="selection-card-price">{pkg.inclusions[0]}</div>
                  </div>
                );
              })}
            </div>
          )}

          <button className="modal-close-trigger" onClick={() => setSelectionModalOpen(false)}>
            Cancel &amp; Close
          </button>
        </div>
      </section>

      <section
        className={`event-selection-overlay ${portalModalOpen ? 'active' : ''}`}
        id="customer-portal-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="portal-modal-title"
      >
        <div className="portal-modal-wrapper">
          <header className="selection-header centered">
            <h2 id="portal-modal-title">Client Portal Access</h2>
            <p id="portal-modal-subtext">
              Enter the email or WhatsApp used on your commission to view live progress, approve drafts, and reply to the studio.
            </p>
          </header>

          <div className="portal-type-toggle" id="portal-type-toggle-container">
            <button
              type="button"
              className={`portal-type-btn ${portalChannel === 'email' ? 'active' : ''}`}
              id="portal-toggle-email"
              onClick={() => setPortalChannel('email')}
            >
              Via Email
            </button>
            <button
              type="button"
              className={`portal-type-btn ${portalChannel === 'whatsapp' ? 'active' : ''}`}
              id="portal-toggle-whatsapp"
              onClick={() => setPortalChannel('whatsapp')}
            >
              Via WhatsApp
            </button>
          </div>

          <form className="portal-form-container" id="portal-request-form" onSubmit={handlePortalAccessRequest}>
            {portalChannel === 'email' ? (
              <div className="luxury-group" id="portal-email-group">
                <label className="luxury-label">Email Address</label>
                <input
                  type="email"
                  id="portal-email-input"
                  className="luxury-input"
                  placeholder="client@example.com"
                  value={portalEmailInput}
                  onChange={(e) => setPortalEmailInput(e.target.value)}
                />
              </div>
            ) : (
              <div className="luxury-group" id="portal-whatsapp-group">
                <label className="luxury-label">WhatsApp Number</label>
                <div className="phone-input-grid">
                  <div className="luxury-select-wrapper">
                    <select
                      id="portal-country-select"
                      name="country_code"
                      className="luxury-select"
                      aria-label="Country code"
                      value={portalCountryCode}
                      onChange={(e) => setPortalCountryCode(e.target.value)}
                    >
                      <option value="+1246">+1 (246) BB</option>
                      <option value="+1">+1 (US/CA)</option>
                      <option value="+44">+44 (UK)</option>
                    </select>
                  </div>
                  <input
                    type="tel"
                    id="portal-whatsapp-input"
                    className="luxury-input"
                    placeholder="842-5133"
                    value={portalWhatsappInput}
                    onChange={(e) => setPortalWhatsappInput(e.target.value)}
                  />
                </div>
              </div>
            )}

            {portalStatusNotice && (
              <div className="portal-notification-banner" id="portal-success-msg" style={{ display: 'block' }}>
                {portalStatusNotice}
              </div>
            )}

            <button type="submit" className="luxury-submit-btn mt-0-5" id="portal-submit-btn">
              Open Live Dashboard
            </button>
          </form>

          {activePortalOrder && (
            <div
              id="portal-live-tracker-node"
              className="portal-live-tracker-node"
              style={{ display: 'block' }}
            >
              <div className="tracking-view-container">
                <div className="tracking-header-badge">
                  <strong>
                    {activePortalOrder.id} — {activePortalOrder.packageName}
                  </strong>
                  <span>{activePortalOrder.finalSettled ? 'Paid in Full' : '50% Deposit Paid'}</span>
                </div>
                <div className="tracking-status-bar">
                  <div className="tracking-progress-fill" style={{ width: `${portalProgressPct}%` }} />
                </div>
                <div className="tracking-timeline">
                  {ORDER_TRACKING_STAGES.map((stage, idx) => {
                    const cls =
                      idx < currentPortalStageIdx
                        ? 'completed'
                        : idx === currentPortalStageIdx
                        ? 'active'
                        : '';
                    return (
                      <div className={`timeline-item ${cls}`} key={stage.key}>
                        <div className="timeline-title">
                          <span>{stage.label}</span>
                        </div>
                        <div className="timeline-desc">{stage.desc}</div>
                      </div>
                    );
                  })}
                </div>

                {(activePortalOrder.status === 'review' ||
                  (activePortalOrder.deliverables && activePortalOrder.deliverables.length > 0) ||
                  (activePortalOrder.draftApproval && activePortalOrder.draftApproval.status !== 'pending')) && (
                  <div
                    className={`approval-banner ${
                      activePortalOrder.draftApproval?.status === 'revisions_requested' ? 'revision-requested' : ''
                    }`}
                  >
                    {activePortalOrder.draftApproval?.status === 'approved' ? (
                      <>
                        <strong style={{ fontSize: '0.85rem' }}>✓ Draft Approved for Finalization</strong>
                        <span className="timeline-desc">
                          Our studio is preparing final delivery.
                        </span>
                      </>
                    ) : activePortalOrder.draftApproval?.status === 'revisions_requested' ? (
                      <>
                        <strong style={{ fontSize: '0.85rem' }}>✎ Revisions Requested</strong>
                        <span className="timeline-desc">Your feedback was sent to the studio.</span>
                        <div className="portal-action-row">
                          <button
                            type="button"
                            className="portal-link-button"
                            onClick={() => submitDraftApproval('approved')}
                          >
                            ✓ Approve Updated Draft
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        <strong style={{ fontSize: '0.85rem' }}>Draft Review &amp; Sign-Off</strong>
                        <span className="timeline-desc">
                          Review your published preview below, then approve it or leave revision notes.
                        </span>
                        <div className="portal-action-row">
                          <button
                            type="button"
                            className="portal-link-button"
                            onClick={() => submitDraftApproval('approved')}
                          >
                            ✓ Approve Draft
                          </button>
                          <button
                            type="button"
                            className="portal-link-button"
                            onClick={() => submitDraftApproval('revisions_requested')}
                          >
                            ✎ Request Revisions
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}

                <div className="portal-section-box">
                  <span className="luxury-label">Drafts &amp; Finished Deliverables</span>
                  {activePortalOrder.deliverables && activePortalOrder.deliverables.length > 0 ? (
                    activePortalOrder.deliverables.map((d, idx) => (
                      <div className="tracking-header-badge" style={{ marginTop: '0.35rem' }} key={idx}>
                        <span>✦ {d.name}</span>
                        <a
                          href={d.dataUrl || d.url}
                          download={d.name}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="portal-link-button"
                          style={{ padding: '0.35rem 0.9rem' }}
                        >
                          Open / Download
                        </a>
                      </div>
                    ))
                  ) : (
                    <p className="timeline-desc">
                      Your draft or finished piece will appear here once published by the studio.
                    </p>
                  )}
                </div>

                <div className="portal-section-box">
                  <span className="luxury-label">Two-Way Atelier Concierge Thread</span>
                  <div className="portal-message-thread" id="portal-thread-scroll">
                    {activePortalOrder.messages && activePortalOrder.messages.length > 0 ? (
                      activePortalOrder.messages.map((m, idx) => {
                        const isClient =
                          m.sender === 'Client' || m.sender === activePortalOrder.clientName;
                        return (
                          <div
                            className={`portal-msg-card ${isClient ? 'client-msg' : ''}`}
                            key={idx}
                          >
                            <strong
                              dangerouslySetInnerHTML={{
                                __html: `${isClient ? 'You' : safeText(m.sender)}:`,
                              }}
                            />{' '}
                            <span dangerouslySetInnerHTML={{ __html: safeText(m.text) }} />
                          </div>
                        );
                      })
                    ) : (
                      <p className="timeline-desc">
                        No messages yet. Send a note directly to your LUMORA designer below.
                      </p>
                    )}
                  </div>
                  <textarea
                    id="portal-client-reply-input"
                    className="portal-reply-box"
                    rows={2}
                    placeholder="Reply to LUMORA Studio or share revision notes..."
                    value={portalReplyText}
                    onChange={(e) => setPortalReplyText(e.target.value)}
                  />
                  <div className="portal-action-row">
                    <button
                      type="button"
                      className="portal-link-button"
                      onClick={sendPortalClientMessage}
                    >
                      Send Reply to Studio →
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          <button
            className="modal-close-trigger"
            onClick={() => {
              setActivePortalOrder(null);
              setPortalModalOpen(false);
            }}
          >
            Cancel &amp; Close
          </button>
        </div>
      </section>

      <section id="dedicated-intake-page">
        <div className="intake-checkout-layout">
          <div className="intake-left-flow">
            <button
              className="intake-back-btn"
              onClick={() => {
                setIntakeActive(false);
                openSelectionModal(activeProductContext);
              }}
            >
              ← Back to Studio
            </button>
            <h2 className="intake-main-title">Personalize Your Piece</h2>
            <p className="intake-subtitle" id="canvas-dynamic-sub">
              {currentPackage.subText}
            </p>

            <form className="luxury-form" id="canvas-order-form" onSubmit={handleRevealPaymentForm}>
              <input type="hidden" id="selected-event-type" value={selectedPackageKey} />

              <div className={`accordion-card ${openAccordions[1] ? 'active' : ''}`} id="accordion-section-1">
                <h3
                  className="form-section-title"
                  onClick={() => setOpenAccordions((prev) => ({ ...prev, 1: !prev[1] }))}
                >
                  Primary Contact &amp; Event Details
                </h3>
                <div className="accordion-content" id="dynamic-form-fields-node">
                  {schemaRows
                    .filter((r) => r.accordion === 1)
                    .map((row, idx) =>
                      row.grid ? (
                        <div className="luxury-grid" key={idx}>
                          {row.grid.map((f) => renderField(f))}
                        </div>
                      ) : (
                        <div key={idx}>{row.fields?.map((f) => renderField(f))}</div>
                      )
                    )}
                </div>
              </div>

              <div className={`accordion-card ${openAccordions[2] ? 'active' : ''}`} id="accordion-section-2">
                <h3
                  className="form-section-title"
                  onClick={() => setOpenAccordions((prev) => ({ ...prev, 2: !prev[2] }))}
                >
                  Theme &amp; Style Preferences
                </h3>
                <div className="accordion-content" id="theme-style-fields-node">
                  {schemaRows
                    .filter((r) => r.accordion === 2)
                    .map((row, idx) =>
                      row.grid ? (
                        <div className="luxury-grid" key={idx}>
                          {row.grid.map((f) => renderField(f))}
                        </div>
                      ) : (
                        <div key={idx}>{row.fields?.map((f) => renderField(f))}</div>
                      )
                    )}
                </div>
              </div>

              <div className={`accordion-card ${openAccordions[3] ? 'active' : ''}`} id="accordion-section-3">
                <h3
                  className="form-section-title"
                  onClick={() => setOpenAccordions((prev) => ({ ...prev, 3: !prev[3] }))}
                >
                  File &amp; Audio Submissions
                </h3>
                <div className="accordion-content" id="file-audio-fields-node">
                  {schemaRows
                    .filter((r) => r.accordion === 3)
                    .map((row, idx) =>
                      row.grid ? (
                        <div className="luxury-grid" key={idx}>
                          {row.grid.map((f) => renderField(f))}
                        </div>
                      ) : (
                        <div key={idx}>{row.fields?.map((f) => renderField(f))}</div>
                      )
                    )}
                </div>
              </div>

              <div className={`accordion-card ${openAccordions[4] ? 'active' : ''}`} id="accordion-section-4">
                <h3
                  className="form-section-title"
                  onClick={() => setOpenAccordions((prev) => ({ ...prev, 4: !prev[4] }))}
                >
                  Enhancements &amp; Final Review
                </h3>
                <div className="accordion-content">
                  <div id="enhancements-section-container">
                    <div className="addons-stack" id="dynamic-addons-injection-node">
                      {currentPackage.addons.length === 0 ? (
                        <p className="selection-card-desc">No additional upgrades available for this tier.</p>
                      ) : (
                        currentPackage.addons.map((addon) => {
                          const checked = !!selectedAddons[addon.id];
                          return (
                            <div
                              key={addon.id}
                              className={`addon-item ${checked ? 'selected' : ''}`}
                              id={`addon-card-${addon.id}`}
                              onClick={() =>
                                setSelectedAddons((prev) => ({ ...prev, [addon.id]: !prev[addon.id] }))
                              }
                            >
                              <input
                                type="checkbox"
                                id={`checkbox-${addon.id}`}
                                className="addon-checkbox"
                                checked={checked}
                                onChange={(e) => {
                                  e.stopPropagation();
                                  setSelectedAddons((prev) => ({ ...prev, [addon.id]: e.target.checked }));
                                }}
                              />
                              <div className="addon-info">
                                <div className="addon-title">
                                  <span>{addon.name}</span>
                                  <span className="addon-price">{formatPriceValue(addon.price, 'addon')}</span>
                                </div>
                                <p className="addon-desc">{addon.desc}</p>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                  <button type="submit" className="luxury-submit-btn" id="submit-form-btn">
                    Confirm Details
                  </button>
                </div>
              </div>
            </form>

            <div className={`payment-terminal-wrapper ${paymentRevealed ? 'reveal' : ''}`} id="terminal-wrapper">
              <h3 className="form-section-title" id="terminal-heading-label">
                Reserve Your Date
              </h3>
              <form className="credit-card-gate" onSubmit={handleProcessLiveDeposit}>
                <div className="luxury-group">
                  <label className="luxury-label">Select Payment Method</label>
                  <div className="portal-type-toggle">
                    <button
                      type="button"
                      className={`portal-type-btn ${selectedPaymentMethod === 'cibc' ? 'active' : ''}`}
                      onClick={() => setSelectedPaymentMethod('cibc')}
                    >
                      1. CIBC First Pay
                    </button>
                    <button
                      type="button"
                      className={`portal-type-btn ${selectedPaymentMethod === 'bimpay' ? 'active' : ''}`}
                      onClick={() => setSelectedPaymentMethod('bimpay')}
                    >
                      2. BimPay
                    </button>
                    <button
                      type="button"
                      className={`portal-type-btn ${selectedPaymentMethod === 'mmoney' ? 'active' : ''}`}
                      onClick={() => setSelectedPaymentMethod('mmoney')}
                    >
                      3. mMoney
                    </button>
                    <button
                      type="button"
                      className={`portal-type-btn ${selectedPaymentMethod === 'wallet' ? 'active' : ''}`}
                      onClick={() => setSelectedPaymentMethod('wallet')}
                    >
                      4. Wallet
                    </button>
                  </div>
                </div>

                {selectedPaymentMethod === 'cibc' && (
                  <>
                    <div className="luxury-group">
                      <label className="luxury-label">Cardholder Name</label>
                      <input
                        type="text"
                        className="luxury-input"
                        placeholder="Julian Vance"
                        required
                        value={cardholderName}
                        onChange={(e) => setCardholderName(e.target.value)}
                      />
                    </div>
                    <div className="luxury-group">
                      <label className="luxury-label">Card Number</label>
                      <input
                        type="text"
                        className="luxury-input"
                        placeholder="••••  ••••  ••••  4242"
                        required
                        maxLength={19}
                        value={cardNumber}
                        onChange={(e) => {
                          const val = e.target.value.replace(/\D/g, '').replace(/(.{4})/g, '$1 ').trim();
                          setCardNumber(val);
                        }}
                      />
                    </div>
                    <div className="credit-card-row">
                      <div className="luxury-group">
                        <label className="luxury-label">Expiration Date</label>
                        <input
                          type="text"
                          className="luxury-input"
                          placeholder="MM/YY"
                          required
                          maxLength={5}
                          value={cardExpiry}
                          onChange={(e) => {
                            let val = e.target.value.replace(/\D/g, '');
                            if (val.length >= 2) val = `${val.substring(0, 2)}/${val.substring(2, 4)}`;
                            setCardExpiry(val);
                          }}
                        />
                      </div>
                      <div className="luxury-group">
                        <label className="luxury-label">CVV</label>
                        <input
                          type="password"
                          className="luxury-input"
                          placeholder="•••"
                          required
                          maxLength={4}
                          value={cardCvv}
                          onChange={(e) => setCardCvv(e.target.value)}
                        />
                      </div>
                      <div className="luxury-group">
                        <label className="luxury-label">ZIP / Postal Code</label>
                        <input
                          type="text"
                          className="luxury-input"
                          placeholder="12345"
                          required
                          value={cardZip}
                          onChange={(e) => setCardZip(e.target.value)}
                        />
                      </div>
                    </div>
                  </>
                )}

                {selectedPaymentMethod !== 'cibc' && (
                  <div className="luxury-group">
                    <label className="luxury-label">
                      {selectedPaymentMethod === 'bimpay'
                        ? 'BimPay Instant Mobile Checkout'
                        : selectedPaymentMethod === 'mmoney'
                        ? 'Digicel mMoney Business Wallet'
                        : 'Apple Pay / Google Wallet Express'}
                    </label>
                    <p className="selection-card-desc">
                      Click below to initialize your {selectedPaymentMethod.toUpperCase()} authorization for{' '}
                      {formatPriceValue(depositUsd, 'summary')}.
                    </p>
                  </div>
                )}

                <button type="submit" className="luxury-submit-btn light-variant" id="pay-button">
                  <span id="pay-btn-text">
                    {isProcessingPayment ? 'Processing Reservation...' : 'Pay Deposit to Secure Date'}
                  </span>
                  <div
                    className="payment-spinner"
                    id="btn-spinner"
                    style={{ display: isProcessingPayment ? 'block' : 'none' }}
                  />
                </button>
              </form>
            </div>
          </div>

          <aside className="checkout-summary-pane">
            <h3 className="summary-title">Your Order Summary</h3>
            <div className="summary-row">
              <span id="summary-base-package-name">{currentPackage.name}</span>
              <span id="summary-base-package-price">{formatPriceValue(currentPackage.basePrice, 'summary')}</span>
            </div>

            <div className="detailed-receipt-header package-details-heading">Included Features</div>
            <div id="dynamic-package-inclusions-node">
              {currentPackage.inclusions.map((inc, idx) => (
                <div className="summary-row itemized core-detail" key={idx}>
                  <span>• {inc}</span>
                  <span>Included</span>
                </div>
              ))}
            </div>

            <div
              className={`detailed-receipt-header ${activeAddonsList.length > 0 ? '' : 'hidden'}`}
              id="addons-header-label"
            >
              Selected Add-Ons
            </div>
            <div id="dynamic-summary-add-ons">
              {activeAddonsList.map((addon) => (
                <div className="summary-row itemized addon-detail" key={addon.id}>
                  <span>+ {addon.name}</span>
                  <span>{formatPriceValue(addon.price, 'summary')}</span>
                </div>
              ))}
            </div>

            <div className="summary-row total-row">
              <span>Total Investment:</span>
              <strong id="summary-total-price">{formatPriceValue(grandTotalUsd, 'summary')}</strong>
            </div>

            <div className="summary-row reserve-date-section">
              <span>Reserve Your Date:</span>
              <span id="summary-retainer-label">50% Upfront Deposit</span>
            </div>

            <div className="summary-row deposit-row">
              <span id="summary-due-label">Deposit Today:</span>
              <strong id="summary-deposit-price">{formatPriceValue(depositUsd, 'summary')}</strong>
            </div>

            <div className="payment-guarantee-note">
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              <span>
                Your deposit holds your date on our studio calendar and lets us start designing your custom project immediately. Payments are safely encrypted.
              </span>
            </div>
          </aside>
        </div>
      </section>
    </>
  );
}
