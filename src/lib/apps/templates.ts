import { defaultConfigFor } from "@/lib/builder/block-defaults";
import { starterFiles } from "@/lib/code/prompt";
import { isMapsBlock } from "@/lib/platform/maps-shared";
import type { BlockConfig, BlockType, ManifestConfig, ThemeConfig } from "@/types/database";

/**
 * Starter apps: what "New app" offers instead of an empty page. Each one is
 * a small, ready-to-publish app (pages, blocks, colours) the customer then
 * makes their own. Nothing here is stored; it's turned into rows when the
 * app is created (`buildStarter`).
 */

export type TemplateIcon =
  | "briefcase"
  | "shopping-bag"
  | "calendar"
  | "utensils"
  | "fuel"
  | "mic"
  | "plus"
  | "dumbbell"
  | "sparkles"
  | "users"
  | "bot"
  | "monitor"
  | "camera"
  | "palette"
  | "graduation-cap"
  | "handshake"
  | "shirt"
  | "home"
  | "heart"
  | "plane"
  | "wrench"
  | "cpu"
  | "stethoscope"
  | "megaphone"
  | "paintbrush";

export interface StarterTemplate {
  id: string;
  name: string;
  tagline: string;
  icon: TemplateIcon;
  /** Brand colour, used for the card, the app's theme and its install icon. */
  color: string;
  /** What the starter contains, as short chips on the card. */
  includes: string[];
  /** Which group the picker lists it under. */
  category: TemplateCategoryId;
  /** Picking this template asks "What's your site about?" before the name step, and uses the answer to write the
   * first draft of the hero's subtext instead of generic placeholder copy (`buildStarter`'s `about` argument). */
  asksAbout?: boolean;
  /** Placeholder shown in that "What's your site about?" box, so the customer sees the kind of answer that works. */
  aboutHint?: string;
  /** Placeholder for the "What's it called?" box. */
  nameHint?: string;
}

/**
 * The topic websites: one full-width, website-layout starter per kind of person or business (Photography, Consulting,
 * Weddings…), the list Squarespace's "What's your site about?" offers. They share one shape — a colour-led banner, a
 * strip of highlights, a short about, testimonials, a newsletter box, then About and Contact pages — and differ in
 * colour, icon and every line of copy. Deliberately photo-less: the banner falls back to the brand colour, so a
 * photographer never opens their new site to a stock photo of someone else's wedding.
 */
export interface WebsiteTopic {
  id: string;
  name: string;
  tagline: string;
  icon: TemplateIcon;
  color: string;
  nameHint: string;
  aboutHint: string;
  eyebrow: string;
  headline: string;
  subtext: string;
  stats: [{ value: string; label: string }, { value: string; label: string }, { value: string; label: string }];
  aboutHeading: string;
  aboutBody: string;
  storyBody: string;
  quote: string;
  reviews: [{ quote: string; name: string }, { quote: string; name: string }];
  newsletterTitle: string;
  newsletterIntro: string;
  contactHeading: string;
  contactBody: string;
  contactTitle: string;
  /** Sections that make the shape fit the trade, each off unless set. A gallery on Home (the visual trades); a
   * bookable calendar on Contact with sample appointments (the ones that take bookings); a product list on Home
   * with sample products (the ones that sell things); a map on Contact (the ones with a patch). */
  galleryTitle?: string;
  bookingTitle?: string;
  sampleEvents?: StarterEvent[];
  shopTitle?: string;
  sampleProducts?: StarterProduct[];
  mapTitle?: string;
}

const SAMPLE_EVENT = "This is a sample. Edit it or delete it under Manage, Events.";
const SAMPLE_PRODUCT = "(Sample product: edit it under Manage, Products.)";

export const WEBSITE_TOPICS: WebsiteTopic[] = [
  {
    id: "photography",
    name: "Photography",
    tagline: "A clean, full-width site for a photographer: your style, your highlights, and a way to book you.",
    icon: "camera",
    color: "#334155",
    nameHint: "Mara Lin Photography",
    aboutHint: "I photograph weddings and families around Seattle, natural light and real moments",
    eyebrow: "Photographer",
    headline: "Real moments, beautifully kept.",
    subtext: "Natural light, honest portraits and the small in-between moments you'll want to keep.",
    stats: [
      { value: "200+", label: "Shoots" },
      { value: "10 yrs", label: "Behind the camera" },
      { value: "5★", label: "From clients" },
    ],
    aboutHeading: "How I work",
    aboutBody: "A relaxed session, no stiff poses. Tell people how a shoot with you feels, what you love to photograph, and where you shoot.",
    storyBody: "Your longer story goes here: how you started, what you shoot, what a session looks like from booking to the finished gallery, and how fast people get their photos.",
    quote: "The best photo is the one nobody knew was being taken.",
    reviews: [
      { quote: "Our whole family felt at ease. The photos look like us, not a photo shoot.", name: "The Okafor family" },
      { quote: "Caught every moment of our day without once getting in the way.", name: "Priya & Tom" },
    ],
    newsletterTitle: "Mini-session dates and new work",
    newsletterIntro: "A few emails a year: seasonal mini-sessions and favourite recent shoots.",
    contactHeading: "Book a session",
    contactBody: "Tell me what you have in mind and when, and I'll reply within a day or two.",
    contactTitle: "Ask about a date",
    galleryTitle: "Recent work",
  },
  {
    id: "design",
    name: "Design",
    tagline: "A sharp, full-width site for a designer or studio: what you make, who you've made it for, and how to hire you.",
    icon: "palette",
    color: "#f59e0b",
    nameHint: "Northwind Studio",
    aboutHint: "I design brands and websites for small food businesses",
    eyebrow: "Design studio",
    headline: "Design that does the job.",
    subtext: "Brands, websites and print for people who need the work to look right and work hard.",
    stats: [
      { value: "60+", label: "Projects shipped" },
      { value: "8 yrs", label: "In practice" },
      { value: "Repeat", label: "Clients, mostly" },
    ],
    aboutHeading: "What I do",
    aboutBody: "Say what you design (brands, websites, packaging, print), how you work with people, and what a finished project looks like.",
    storyBody: "The longer version: your background, your process from first call to final files, and the kind of clients you do your best work for.",
    quote: "Good design is obvious. Great design is transparent.",
    reviews: [
      { quote: "Got exactly what we needed, and a few things we didn't know we needed.", name: "Dana R., café owner" },
      { quote: "Clear, calm and on time. Rare.", name: "Marcus P., founder" },
    ],
    newsletterTitle: "New work, occasionally",
    newsletterIntro: "When something ships that I'm proud of. A handful of emails a year.",
    contactHeading: "Start a project",
    contactBody: "A few lines about what you need and when. I'll come back with questions and a rough idea of cost.",
    contactTitle: "Tell me about your project",
  },
  {
    id: "education",
    name: "Education",
    tagline: "A friendly, full-width site for a tutor, teacher or course: what you teach, who it's for, and how to sign up.",
    icon: "graduation-cap",
    color: "#2563eb",
    nameHint: "Bright Start Tutoring",
    aboutHint: "I tutor high-school maths and physics, in person and online",
    eyebrow: "Tutoring",
    headline: "Learning that finally clicks.",
    subtext: "Patient, one-to-one teaching that meets each student where they are.",
    stats: [
      { value: "300+", label: "Students taught" },
      { value: "12 yrs", label: "Teaching" },
      { value: "1st", label: "Session free" },
    ],
    aboutHeading: "How lessons work",
    aboutBody: "Say what you teach, which ages or levels, where (in person, online, both) and what a first session is like.",
    storyBody: "Your background as a teacher, how you approach a student who's struggling, and what families can expect week to week.",
    quote: "Every student can get there. Some just need a different path.",
    reviews: [
      { quote: "Went from dreading maths to actually enjoying it. Grades followed.", name: "Sam's mum" },
      { quote: "Explains things three different ways until one lands.", name: "Leo, year 11" },
    ],
    newsletterTitle: "Term dates and study tips",
    newsletterIntro: "A short email before each term: what's open, plus one study tip that helps.",
    contactHeading: "Book a first session",
    contactBody: "Tell me about the student and what they're working toward. The first session is free.",
    contactTitle: "Get in touch",
    bookingTitle: "Book a lesson",
    sampleEvents: [
      { title: "Free first session", description: `Meet, talk through goals, try a short lesson. ${SAMPLE_EVENT}`, dayOffset: 1, time: "16:00", minutes: 60, capacity: 1 },
      { title: "Maths: exam prep", description: `Past papers and the topics that come up most. ${SAMPLE_EVENT}`, dayOffset: 2, time: "17:00", minutes: 60, capacity: 1 },
      { title: "Physics: mechanics", description: `Forces, motion and the questions everyone finds hard. ${SAMPLE_EVENT}`, dayOffset: 3, time: "17:00", minutes: 60, capacity: 1 },
    ],
  },
  {
    id: "consulting",
    name: "Consulting",
    tagline: "A credible, full-width site for a consultant or advisor: what you fix, proof it works, and a way to talk.",
    icon: "handshake",
    color: "#4338ca",
    nameHint: "Harbor Advisory",
    aboutHint: "I help small businesses sort out their finances and plan for growth",
    eyebrow: "Consulting",
    headline: "Clear advice. Real results.",
    subtext: "Practical help for owners and teams who need an outside view and a plan that actually gets done.",
    stats: [
      { value: "80+", label: "Clients" },
      { value: "15 yrs", label: "Experience" },
      { value: "Free", label: "First call" },
    ],
    aboutHeading: "What I help with",
    aboutBody: "Name the two or three problems you solve best, who you solve them for, and what working together looks like.",
    storyBody: "Where your experience comes from, the kinds of businesses you've helped, and how an engagement runs from first call to results.",
    quote: "Advice is only useful if it turns into action.",
    reviews: [
      { quote: "Paid for itself in the first quarter. Should have called years ago.", name: "Jen T., owner" },
      { quote: "Straight talk, no jargon, and a plan we could actually follow.", name: "Omar F., director" },
    ],
    newsletterTitle: "One idea a month",
    newsletterIntro: "A short, useful note each month. No pitches.",
    contactHeading: "Let's talk",
    contactBody: "A few lines about your situation is enough. The first call is free.",
    contactTitle: "Book a free call",
    bookingTitle: "Book a call",
    sampleEvents: [
      { title: "Free first call", description: `Thirty minutes to talk through where you are. ${SAMPLE_EVENT}`, dayOffset: 1, time: "10:00", minutes: 30, capacity: 1 },
      { title: "Strategy session", description: `A working session on one problem, with a plan at the end. ${SAMPLE_EVENT}`, dayOffset: 3, time: "14:00", minutes: 90, capacity: 1 },
      { title: "Finance review", description: `Numbers, cash flow and what to change first. ${SAMPLE_EVENT}`, dayOffset: 5, time: "11:00", minutes: 60, capacity: 1 },
    ],
  },
  {
    id: "art",
    name: "Art",
    tagline: "A quiet, full-width site for an artist: your work, your story, and how to buy or commission a piece.",
    icon: "paintbrush",
    color: "#dc2626",
    nameHint: "Elena Vos",
    aboutHint: "I paint large abstract landscapes and take commissions",
    eyebrow: "Artist",
    headline: "Work that stays with you.",
    subtext: "Original pieces and commissions, made slowly and by hand.",
    stats: [
      { value: "120+", label: "Works sold" },
      { value: "9", label: "Exhibitions" },
      { value: "Open", label: "To commissions" },
    ],
    aboutHeading: "About the work",
    aboutBody: "What you make, the materials and scale, what draws you to it, and whether people can buy originals, prints or commissions.",
    storyBody: "Your path as an artist, what the work is about, and how a commission works from first conversation to delivery.",
    quote: "Make the thing you want to see on the wall.",
    reviews: [
      { quote: "The piece is the first thing everyone asks about when they walk in.", name: "A collector" },
      { quote: "The commission was exactly as we imagined, and then some.", name: "R. & M. Hale" },
    ],
    newsletterTitle: "New work and shows",
    newsletterIntro: "When new pieces are ready or a show opens. A few emails a year.",
    contactHeading: "Buy or commission",
    contactBody: "Ask about a piece, a print or a commission. I'll reply within a few days.",
    contactTitle: "Get in touch",
    galleryTitle: "Selected work",
  },
  {
    id: "health",
    name: "Health",
    tagline: "A calm, full-width site for a clinic or practitioner: what you treat, how to book, and what to expect.",
    icon: "stethoscope",
    color: "#059669",
    nameHint: "Cedar Physiotherapy",
    aboutHint: "I'm a physiotherapist helping people recover from injury and get moving again",
    eyebrow: "Clinic",
    headline: "Feel better, move better.",
    subtext: "Hands-on care and a clear plan, for pain that's been hanging around too long.",
    stats: [
      { value: "2,000+", label: "Patients" },
      { value: "15 yrs", label: "In practice" },
      { value: "Same wk", label: "Appointments" },
    ],
    aboutHeading: "What we treat",
    aboutBody: "The conditions you see most, what a first visit involves, and how you work with each patient toward getting back to normal.",
    storyBody: "Your qualifications and experience, your approach, and what someone can expect from their first appointment through recovery.",
    quote: "The best plan is the one you'll actually follow.",
    reviews: [
      { quote: "Back running after six weeks when I'd been told to give up on it.", name: "Chris W." },
      { quote: "Actually listened, explained everything, and the plan worked.", name: "Amina S." },
    ],
    newsletterTitle: "Simple tips for staying well",
    newsletterIntro: "A short, practical email each month. No medical jargon.",
    contactHeading: "Book an appointment",
    contactBody: "Tell us what's going on and when suits you. We'll get back to you the same day where we can.",
    contactTitle: "Request an appointment",
    bookingTitle: "Book an appointment",
    sampleEvents: [
      { title: "New patient assessment", description: `A full look at what's going on and a plan to start. ${SAMPLE_EVENT}`, dayOffset: 1, time: "09:00", minutes: 45, capacity: 1 },
      { title: "Follow-up appointment", description: `Check progress, adjust the plan. ${SAMPLE_EVENT}`, dayOffset: 1, time: "14:00", minutes: 30, capacity: 1 },
      { title: "Sports injury check", description: `For a new niggle before it becomes a problem. ${SAMPLE_EVENT}`, dayOffset: 2, time: "11:00", minutes: 30, capacity: 1 },
    ],
  },
  {
    id: "marketing",
    name: "Marketing",
    tagline: "A confident, full-width site for a marketer or agency: what you grow, how, and the numbers to prove it.",
    icon: "megaphone",
    color: "#d97706",
    nameHint: "Signal & Noise",
    aboutHint: "I run ads and email for local service businesses that want more customers",
    eyebrow: "Marketing",
    headline: "More of the right customers.",
    subtext: "Ads, email and content that bring in people who actually buy — measured, not guessed.",
    stats: [
      { value: "3×", label: "Average return" },
      { value: "40+", label: "Clients grown" },
      { value: "Monthly", label: "Plain-English reports" },
    ],
    aboutHeading: "What we do",
    aboutBody: "The channels you run, the kind of businesses you grow, and how you report results so a client always knows what's working.",
    storyBody: "Your background, a couple of results you're proud of, and how an engagement runs month to month.",
    quote: "If it can't be measured, it's a guess.",
    reviews: [
      { quote: "Bookings doubled in three months. The reports make sense to me, which is new.", name: "Tasha B., salon owner" },
      { quote: "First agency that told us what not to spend on.", name: "Daniel K., founder" },
    ],
    newsletterTitle: "What's working right now",
    newsletterIntro: "One real, specific marketing idea a month. Short.",
    contactHeading: "Grow your business",
    contactBody: "Tell us what you sell and what you want more of. We'll come back with an honest first take.",
    contactTitle: "Get a free first take",
  },
  {
    id: "technology",
    name: "Technology",
    tagline: "A crisp, full-width site for a software, IT or tech business: what you build, who it's for, and how to get started.",
    icon: "cpu",
    color: "#0ea5e9",
    nameHint: "Ridgeline Software",
    aboutHint: "We build custom software and fix IT for small businesses",
    eyebrow: "Technology",
    headline: "Software that just works.",
    subtext: "Custom tools, reliable IT and straight answers for businesses that can't afford downtime.",
    stats: [
      { value: "99.9%", label: "Uptime" },
      { value: "150+", label: "Projects" },
      { value: "< 1 hr", label: "Support response" },
    ],
    aboutHeading: "What we build",
    aboutBody: "What you make or manage (software, apps, networks, support), who it's for, and what makes working with you easy.",
    storyBody: "Your team's background, the problems you solve best, and how a project runs from first conversation to launch and support.",
    quote: "The best technology is the kind you stop noticing.",
    reviews: [
      { quote: "Replaced three spreadsheets and a headache with one tool our team actually uses.", name: "Grace H., operations" },
      { quote: "When something breaks they answer the phone. That's the whole review.", name: "Ben C., owner" },
    ],
    newsletterTitle: "Tech notes for non-techies",
    newsletterIntro: "One plain-English note a month: what to update, what to ignore, what's worth it.",
    contactHeading: "Start a conversation",
    contactBody: "Tell us what you're trying to do or what keeps breaking. No jargon required.",
    contactTitle: "Get in touch",
  },
  {
    id: "construction",
    name: "Construction & maintenance",
    tagline: "A solid, full-width site for a builder, contractor or trade: your work, your area, and how to get a quote.",
    icon: "wrench",
    color: "#b45309",
    nameHint: "Pacific Ridge Builders",
    aboutHint: "We're a family-run building company doing renovations and extensions",
    eyebrow: "Builders",
    headline: "Built right, built to last.",
    subtext: "Renovations, extensions and repairs by a crew that shows up when it says it will.",
    stats: [
      { value: "25 yrs", label: "In the trade" },
      { value: "500+", label: "Jobs done" },
      { value: "Licensed", label: "& insured" },
    ],
    aboutHeading: "What we do",
    aboutBody: "The work you take on (renovations, extensions, repairs, maintenance), the area you cover, and how you quote.",
    storyBody: "How the business started, the crew, the kind of jobs you're proudest of, and what a customer can expect from quote to clean-up.",
    quote: "Measure twice. Show up on time. Leave it tidy.",
    reviews: [
      { quote: "On budget, on schedule, and they left the site cleaner than they found it.", name: "The Nguyens" },
      { quote: "Honest quote, no surprises, great work.", name: "Rob M." },
    ],
    newsletterTitle: "Seasonal maintenance reminders",
    newsletterIntro: "A short note a few times a year: what to check before winter, before summer, and when to call.",
    contactHeading: "Get a quote",
    contactBody: "Tell us about the job and where you are. We'll come out, have a look and give you a straight price.",
    contactTitle: "Request a quote",
  },
  {
    id: "apparel",
    name: "Apparel",
    tagline: "A stylish, full-width site for a clothing brand or boutique: your look, your story, and where to buy.",
    icon: "shirt",
    color: "#db2777",
    nameHint: "Loom & Thread",
    aboutHint: "We make small-batch linen clothing, designed and sewn locally",
    eyebrow: "Clothing",
    headline: "Made to be worn for years.",
    subtext: "Small-batch pieces, cut to last and made by people we know by name.",
    stats: [
      { value: "Small", label: "Batches" },
      { value: "Local", label: "Made" },
      { value: "Free", label: "Returns" },
    ],
    aboutHeading: "The story",
    aboutBody: "What you make, how it's made and where, and what you care about (fabric, fit, who sews it).",
    storyBody: "How the label started, who makes the clothes, where the fabric comes from, and what you're trying to do differently.",
    quote: "Buy less. Choose well. Make it last.",
    reviews: [
      { quote: "The linen shirt is three summers old and still my favourite thing I own.", name: "Hannah L." },
      { quote: "Finally clothes that fit a real body.", name: "Ana R." },
    ],
    newsletterTitle: "New drops and restocks",
    newsletterIntro: "First word on new pieces and restocks. A few emails a season.",
    contactHeading: "Say hello",
    contactBody: "Questions about sizing, stockists or wholesale? Send a note.",
    contactTitle: "Get in touch",
    galleryTitle: "The collection",
    shopTitle: "Shop",
    sampleProducts: [
      { name: "Linen shirt", description: `Relaxed fit, washed linen, made to soften with every wear. ${SAMPLE_PRODUCT}`, priceCents: 9800 },
      { name: "Everyday tee", description: `Heavyweight organic cotton, boxy cut. ${SAMPLE_PRODUCT}`, priceCents: 4200 },
      { name: "Wide-leg trouser", description: `High waist, deep pockets, linen-cotton blend. ${SAMPLE_PRODUCT}`, priceCents: 12800 },
    ],
  },
  {
    id: "music",
    name: "Music",
    tagline: "A moody, full-width site for a musician, band or teacher: your sound, your dates, and how to book you.",
    icon: "mic",
    color: "#7e22ce",
    nameHint: "The Low Tide Band",
    aboutHint: "I'm a singer-songwriter playing venues and weddings across the Pacific Northwest",
    eyebrow: "Musician",
    headline: "Music people remember.",
    subtext: "Live sets for venues, weddings and private events, with a sound that fits the room.",
    stats: [
      { value: "400+", label: "Shows played" },
      { value: "12 yrs", label: "On stage" },
      { value: "Solo", label: "Or full band" },
    ],
    aboutHeading: "The sound",
    aboutBody: "Describe what you play and how it sounds, the kinds of events you do, and what people can expect on the night.",
    storyBody: "How you started, what you've played and where, and what booking you looks like from first message to soundcheck.",
    quote: "Play the room, not the setlist.",
    reviews: [
      { quote: "The dance floor was full from the first song to the last.", name: "Jess & Marco, wedding" },
      { quote: "Reads a crowd better than anyone we've booked.", name: "The Corner Pub" },
    ],
    newsletterTitle: "Gig dates and new songs",
    newsletterIntro: "Where I'm playing next and the occasional new song. Short and not too often.",
    contactHeading: "Book a show",
    contactBody: "Tell me the date, the place and the kind of night you're after.",
    contactTitle: "Ask about a date",
  },
  {
    id: "realestate",
    name: "Real estate & properties",
    tagline: "A trustworthy, full-width site for an agent or property business: your area, your results, and how to reach you.",
    icon: "home",
    color: "#15803d",
    nameHint: "Maple & Oak Realty",
    aboutHint: "I help families buy and sell homes in North Seattle",
    eyebrow: "Real estate",
    headline: "The right home, without the stress.",
    subtext: "Local knowledge, honest advice and a calm hand through every step of buying or selling.",
    stats: [
      { value: "150+", label: "Homes sold" },
      { value: "14 yrs", label: "In the area" },
      { value: "5★", label: "Client rating" },
    ],
    aboutHeading: "How I work",
    aboutBody: "The neighbourhoods you know best, whether you help buyers, sellers or both, and what people get from working with you.",
    storyBody: "Your background, the area you cover, a couple of stories about clients you've helped, and how the process runs start to finish.",
    quote: "A home is the biggest decision most people make. It deserves a straight answer.",
    reviews: [
      { quote: "Sold in nine days, over asking, and we never felt rushed.", name: "The Alvarez family" },
      { quote: "Talked us out of two houses before we found the right one. That's trust.", name: "Kim & Jordan" },
    ],
    newsletterTitle: "What's happening in the market",
    newsletterIntro: "A short monthly note on prices, new listings and what it means for you.",
    contactHeading: "Let's talk about your move",
    contactBody: "Buying, selling or just curious what your place is worth? Send a note.",
    contactTitle: "Get in touch",
    mapTitle: "Where I work",
  },
  {
    id: "beauty",
    name: "Beauty",
    tagline: "A soft, full-width site for a beautician, spa or makeup artist: your services, your work, and how to book.",
    icon: "sparkles",
    color: "#c026d3",
    nameHint: "Glow by Nadia",
    aboutHint: "I do bridal and event makeup, plus lashes and brows from my studio",
    eyebrow: "Beauty",
    headline: "Look like you, on your best day.",
    subtext: "Makeup, lashes and skin care that enhances what's already there.",
    stats: [
      { value: "500+", label: "Clients" },
      { value: "10 yrs", label: "Experience" },
      { value: "Bridal", label: "& events" },
    ],
    aboutHeading: "What I offer",
    aboutBody: "Your services (makeup, lashes, brows, skin, nails), where you work (studio, mobile, both) and what a first appointment is like.",
    storyBody: "How you trained, what you love doing most, and what a client can expect from booking to the finished look.",
    quote: "The goal isn't a different face. It's the same face, rested.",
    reviews: [
      { quote: "My wedding makeup lasted fourteen hours and I still looked like me.", name: "Chloe W." },
      { quote: "Gentle, quick and the lashes are perfect every time.", name: "Emily J." },
    ],
    newsletterTitle: "Openings and seasonal offers",
    newsletterIntro: "When appointments open up, plus the occasional offer. Not too often.",
    contactHeading: "Book an appointment",
    contactBody: "Tell me what you'd like and when, and I'll confirm a time.",
    contactTitle: "Request a booking",
    bookingTitle: "Book an appointment",
    sampleEvents: [
      { title: "Bridal makeup trial", description: `Try the look before the day. ${SAMPLE_EVENT}`, dayOffset: 2, time: "10:00", minutes: 90, capacity: 1 },
      { title: "Lash appointment", description: `A full set or an infill. ${SAMPLE_EVENT}`, dayOffset: 1, time: "13:00", minutes: 60, capacity: 1 },
      { title: "Brow shape & tint", description: `Thirty minutes, lasts weeks. ${SAMPLE_EVENT}`, dayOffset: 3, time: "16:00", minutes: 30, capacity: 1 },
    ],
  },
  {
    id: "travel",
    name: "Travel",
    tagline: "A bright, full-width site for a travel guide, planner or tour: where you take people and how to come along.",
    icon: "plane",
    color: "#0d9488",
    nameHint: "Wander North Tours",
    aboutHint: "I run small-group walking tours of the city's hidden history",
    eyebrow: "Tours",
    headline: "See it the way locals do.",
    subtext: "Small groups, real stories and the places that aren't in the guidebook.",
    stats: [
      { value: "12", label: "Max group size" },
      { value: "3,000+", label: "Happy travellers" },
      { value: "Daily", label: "Departures" },
    ],
    aboutHeading: "What we do",
    aboutBody: "Where you go, how long it takes, what's included, and what makes your tour different from the big bus.",
    storyBody: "How you started guiding, what you love about the place, and what a day with you looks like from meeting point to goodbye.",
    quote: "The best trips are the ones you couldn't have planned.",
    reviews: [
      { quote: "We've lived here ten years and learned more in three hours than in all of them.", name: "Priya S." },
      { quote: "Felt like being shown around by a friend.", name: "Natalie V." },
    ],
    newsletterTitle: "New routes and seasonal tours",
    newsletterIntro: "When a new tour launches or a seasonal one comes back. A few emails a year.",
    contactHeading: "Book a tour",
    contactBody: "Tell us your dates and group size, or ask about a private tour.",
    contactTitle: "Ask about dates",
  },
  {
    id: "weddings",
    name: "Weddings",
    tagline: "An elegant, full-width site for a planner, venue or wedding vendor: your style, your work, and how to enquire.",
    icon: "heart",
    color: "#fb7185",
    nameHint: "Willow & Vine Weddings",
    aboutHint: "I plan relaxed, outdoor weddings in the Pacific Northwest",
    eyebrow: "Weddings",
    headline: "Your day, beautifully handled.",
    subtext: "Thoughtful planning and a calm presence, so you can actually enjoy the day you've been dreaming about.",
    stats: [
      { value: "90+", label: "Weddings" },
      { value: "8 yrs", label: "Planning" },
      { value: "Full", label: "Or day-of" },
    ],
    aboutHeading: "How I help",
    aboutBody: "What you offer (full planning, day-of coordination, styling), the kinds of weddings you love, and what couples get from working with you.",
    storyBody: "How you got into weddings, a couple of favourite days, and how the process works from first chat to the last dance.",
    quote: "The best weddings feel like the couple, not the catalogue.",
    reviews: [
      { quote: "We didn't think about a single logistic on the day. Not one.", name: "Sarah & James" },
      { quote: "Calm, kind and somehow everywhere at once.", name: "Mei & Daniel" },
    ],
    newsletterTitle: "Planning tips and open dates",
    newsletterIntro: "A short note now and then: one useful planning tip and which dates are still open.",
    contactHeading: "Tell me about your day",
    contactBody: "Your date (or rough season), where, and what you're imagining. I'll reply within a couple of days.",
    contactTitle: "Enquire",
    galleryTitle: "Real weddings",
  },
];

const WEBSITE_TOPIC_BY_ID = new Map(WEBSITE_TOPICS.map((t) => [t.id, t]));

/** How long an answer to "What's your site about?" may be — long enough for a real sentence, short enough that it
 * still reads well as a hero subtext rather than a paragraph. */
export const ABOUT_MAX_LENGTH = 240;

export type TemplateCategoryId = "website" | "food" | "fitness" | "shops" | "venues" | "local" | "scratch" | "ai";

/** The picker's groups, in the order they are shown. */
export const TEMPLATE_CATEGORIES: Array<{ id: TemplateCategoryId; name: string; blurb: string }> = [
  { id: "website", name: "Website", blurb: "Full width on a laptop, with a menu at the top — not a phone-shaped column" },
  { id: "food", name: "Restaurants & cafés", blurb: "Menus, reservations and what's open now" },
  { id: "fitness", name: "Gyms & studios", blurb: "Class schedules and free-trial sign-ups" },
  { id: "shops", name: "Shops & services", blurb: "Sell products, take bookings, or just get found" },
  { id: "venues", name: "Venues, events & community", blurb: "Events people can book, and a home for your group" },
  { id: "local", name: "Local info", blurb: "Live data for the neighbourhood" },
  { id: "scratch", name: "Start from scratch", blurb: "Build exactly what you want" },
  { id: "ai", name: "Bring your own bot", blurb: "Use your own Claude or ChatGPT key and build your app by chatting" },
];

export const STARTER_TEMPLATES: StarterTemplate[] = [
  {
    id: "portfolio",
    name: "Personal website",
    tagline: "A full-width site for your own name: your story, highlights, testimonials and a way for people to reach you.",
    icon: "monitor",
    color: "#1d4ed8",
    includes: ["Full-width website", "Banner", "Highlights", "Testimonials", "Newsletter", "Contact"],
    category: "website",
    asksAbout: true,
    nameHint: "Jordan Lee",
    aboutHint: "I'm a career coach helping people land their next role",
  },
  // One card per topic, after the general Personal website. Same shape and chips; the copy is the difference.
  ...WEBSITE_TOPICS.map(
    (t): StarterTemplate => ({
      id: t.id,
      name: t.name,
      tagline: t.tagline,
      icon: t.icon,
      color: t.color,
      includes: ["Full-width website", "Banner", "Highlights", "Testimonials", "Newsletter", "Contact"],
      category: "website",
      asksAbout: true,
      nameHint: t.nameHint,
      aboutHint: t.aboutHint,
    })
  ),
  {
    id: "business",
    name: "Local business",
    tagline: "A warm, welcoming home for any local shop: your story, photos, reviews and hours.",
    icon: "briefcase",
    color: "#4f46e5",
    includes: ["Photo banner", "About", "Gallery", "Reviews", "Hours", "Contact"],
    category: "shops",
  },
  {
    id: "store",
    name: "Online store",
    tagline: "A beautiful little shop with sample products, card payments and pickup info.",
    icon: "shopping-bag",
    color: "#a16207",
    includes: ["Photo banner", "Products", "Gallery", "Reviews", "Hours"],
    category: "shops",
  },
  {
    id: "events",
    name: "Events & bookings",
    tagline: "Tastings, workshops and live nights, with sample events people can book right away.",
    icon: "calendar",
    color: "#7c3aed",
    includes: ["Photo banner", "Bookable events", "Gallery", "Reviews", "Contact"],
    category: "venues",
  },
  {
    id: "food",
    name: "Food finder",
    tagline: "Live open and closing-soon status for restaurants near each visitor.",
    icon: "utensils",
    color: "#f97316",
    includes: ["Live food directory"],
    category: "food",
  },
  {
    id: "gas",
    name: "Gas prices",
    tagline: "The cheapest gas near each visitor, with directions and community updates.",
    icon: "fuel",
    color: "#10b981",
    includes: ["Live gas prices"],
    category: "local",
  },
  {
    id: "openmic",
    name: "Open mic list",
    tagline: "A moody, stage-lit guide to every open mic tonight, with a form for hosts.",
    icon: "mic",
    color: "#f43f5e",
    includes: ["Photo banner", "Mics tonight", "Gallery", "Reviews", "Host form"],
    category: "venues",
  },
  {
    id: "restaurant",
    name: "Restaurant or café",
    tagline: "Mouth-watering photos, your full menu, hours and table reservations.",
    icon: "utensils",
    color: "#c2410c",
    includes: ["Photo banner", "Menu", "Gallery", "Reviews", "Hours", "Reservations"],
    category: "food",
  },
  {
    id: "fitness",
    name: "Gym or studio",
    tagline: "A bold, dark look with your classes, memberships and free-trial sign-ups.",
    icon: "dumbbell",
    color: "#e11d48",
    includes: ["Photo banner", "Class booking", "Memberships", "Gallery", "Reviews", "Free trial"],
    category: "fitness",
  },
  {
    id: "salon",
    name: "Salon or services",
    tagline: "An elegant look with your services and prices, gallery, reviews and online booking.",
    icon: "sparkles",
    color: "#be185d",
    includes: ["Photo banner", "Services & prices", "Booking", "Gallery", "Reviews"],
    category: "shops",
  },
  {
    id: "community",
    name: "Club or community",
    tagline: "A warm home for your group: upcoming events, photos and a free sign-up.",
    icon: "users",
    color: "#0f766e",
    includes: ["Photo banner", "Events", "Gallery", "Reviews", "Join form"],
    category: "venues",
  },
  {
    id: "blank",
    name: "Start from scratch",
    tagline: "An empty app. Add exactly the blocks you want.",
    icon: "plus",
    color: "#64748b",
    includes: [],
    category: "scratch",
  },
  {
    id: "byob",
    name: "BYOB: Bring your own bot",
    tagline: "Describe any app and your own Claude or ChatGPT builds it for real, live, as you chat. Polished React apps, no coding.",
    icon: "bot",
    color: "#4f46e5",
    includes: ["AI writes the app", "Live preview", "Undo any change", "Your own AI key"],
    category: "ai",
  },
];

export const DEFAULT_TEMPLATE_ID = "blank";

/** Does this starter use Google Maps (Live food, Gas prices)? */
export function templateNeedsMaps(id: string): boolean {
  return buildStarter(id, "x").pages.some((p) => p.blocks.some((b) => isMapsBlock(b.type)));
}

export function isTemplateId(id: string): boolean {
  return STARTER_TEMPLATES.some((t) => t.id === id);
}

export interface StarterBlock {
  type: BlockType;
  config: BlockConfig;
}
export interface StarterPage {
  name: string;
  path: string;
  isHome: boolean;
  blocks: StarterBlock[];
}
/** A sample event created with the app, so a booking page isn't empty on first open. */
export interface StarterEvent {
  title: string;
  description: string;
  /** Days from today (0 = today). */
  dayOffset: number;
  /** Local start time, "HH:MM". */
  time: string;
  minutes: number;
  capacity: number;
}

/** A sample product created with the app, so a shop isn't empty on first open. */
export interface StarterProduct {
  name: string;
  description: string;
  priceCents: number;
  /** Left out for a starter that ships no photos; the product card simply has no picture until the owner adds one. */
  image?: string;
}

/** A sample open mic (or other listing) created with the app, so the list isn't empty on first open. */
export interface StarterListing {
  slug: string;
  record: Record<string, unknown>;
}

export interface Starter {
  theme: ThemeConfig;
  manifest: ManifestConfig;
  pages: StarterPage[];
  events?: StarterEvent[];
  products?: StarterProduct[];
  listings?: StarterListing[];
  /** A code app (BYOB): the AI writes a React app. These are its first files. */
  codeFiles?: Record<string, string>;
}

/** A photo that ships with TapAndLaunch (public/templates), as a full address so it also loads inside customers' apps. */
export function templatePhoto(name: string): string {
  const root = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "localhost:3000";
  const local = /^(localhost|127\.|\d{1,3}(\.\d{1,3}){3})/.test(root);
  return `${local ? "http" : "https"}://${root}/templates/${name}.jpg`;
}

/** A sample open mic in the shape the open mic list reads. Clearly named as a sample in its notes. */
function sampleMic(id: string, name: string, venue: string, time: string, type: string, days: string, notes: string): Record<string, unknown> {
  const on = new Set(days.split(","));
  const week = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
  return {
    id,
    name,
    venue,
    location: "",
    timeSignupStart: time,
    openMicType: type,
    priceForTime: "Free",
    requirementsInfo: `${notes} (Sample listing: edit or remove it under Manage, Listings.)`,
    ...Object.fromEntries(week.map((d) => [d, on.has(d) ? "Yes" : "no"])),
  };
}

const SAMPLE_NOTE = "This is a sample. Edit it or delete it under Manage, Events.";

const block = (type: BlockType, overrides: Record<string, unknown> = {}): StarterBlock => ({
  type,
  config: { ...defaultConfigFor(type), ...overrides } as BlockConfig,
});

const CONTACT_FIELDS = [
  { name: "name", label: "Your name", type: "text", required: true },
  { name: "email", label: "Email", type: "email", required: true },
  { name: "message", label: "Message", type: "textarea" },
];

/** The rows for a new app of this template, named `appName`. Every starter begins with the app's name in the header
 * bar. `about` is the customer's own answer to "What's your site about?" (only asked, and only used, for a
 * template with `asksAbout: true`); trimmed to `ABOUT_MAX_LENGTH` and ignored for every other template. */
export function buildStarter(templateId: string, appName: string, about?: string): Starter {
  const starter = buildStarterBody(templateId, appName, about?.trim().slice(0, ABOUT_MAX_LENGTH));
  return { ...starter, theme: { ...starter.theme, header_title: appName } };
}

function buildStarterBody(templateId: string, appName: string, about?: string): Starter {
  const template = STARTER_TEMPLATES.find((t) => t.id === templateId) ?? (STARTER_TEMPLATES.find((t) => t.id === DEFAULT_TEMPLATE_ID) as StarterTemplate);
  const manifest: ManifestConfig = {
    name: appName,
    short_name: appName.slice(0, 12),
    theme_color: template.color,
    display: "standalone",
  };
  const theme: ThemeConfig = { primary_color: template.color };
  const home = (blocks: StarterBlock[]): StarterPage => ({ name: "Home", path: "home", isHome: true, blocks });

  // The topic websites share one shape (see `WebsiteTopic`); only the words and colour differ.
  const topic = WEBSITE_TOPIC_BY_ID.get(template.id);
  if (topic) {
    return {
      manifest: { ...manifest, background_color: "#fafafa" },
      theme: {
        ...theme,
        layout: "website",
        background_color: "#fafafa",
        bottom_nav_style: "tabs",
        bottom_nav: [
          { label: "Home", icon: "home", page_path: "home" },
          { label: "About", icon: "info", page_path: "about" },
          { label: "Contact", icon: "mail", page_path: "contact" },
        ],
      },
      pages: [
        home([
          block("hero", { eyebrow: topic.eyebrow, headline: topic.headline, subtext: about || topic.subtext, button_label: "Get in touch", button_page: "contact" }),
          block("stats", { items: topic.stats }),
          // The visual trades show their work before they explain it; the empty gallery is a "No photos yet" box in
          // the builder and nothing on the live site until photos are added.
          ...(topic.galleryTitle ? [block("gallery", { title: topic.galleryTitle, images: [] })] : []),
          block("text", { heading: topic.aboutHeading, body: topic.aboutBody }),
          ...(topic.shopTitle ? [block("product_list", { title: topic.shopTitle })] : []),
          block("reviews", { title: "What people say", items: topic.reviews.map((r) => ({ ...r, rating: 5 })) }),
          block("newsletter", { title: topic.newsletterTitle, intro: topic.newsletterIntro, button_label: "Sign up", success: "You're on the list." }),
        ]),
        {
          name: "About",
          path: "about",
          isHome: false,
          blocks: [block("text", { heading: "My story", body: topic.storyBody }), block("quote", { quote: topic.quote, name: "" })],
        },
        {
          name: "Contact",
          path: "contact",
          isHome: false,
          blocks: [
            block("text", { heading: topic.contactHeading, body: topic.contactBody }),
            ...(topic.bookingTitle ? [block("event_calendar", { title: topic.bookingTitle })] : []),
            // No invented address: the map is a "Type the address on the right" box in the builder until it has one.
            ...(topic.mapTitle ? [block("map", { title: topic.mapTitle, address: "" })] : []),
            block("contact_form", { title: topic.contactTitle, submit_label: "Send message", fields: CONTACT_FIELDS }),
          ],
        },
      ],
      events: topic.sampleEvents,
      products: topic.sampleProducts,
    };
  }

  switch (template.id) {
    case "portfolio":
      return {
        manifest: { ...manifest, background_color: "#fafafa" },
        theme: {
          ...theme,
          layout: "website",
          background_color: "#fafafa",
          bottom_nav_style: "tabs",
          bottom_nav: [
            { label: "Home", icon: "home", page_path: "home" },
            { label: "About", icon: "info", page_path: "about" },
            { label: "Contact", icon: "mail", page_path: "contact" },
          ],
        },
        pages: [
          home([
            block("hero", {
              eyebrow: "Welcome",
              headline: "Hi, I'm here to help.",
              subtext: about || "A short line about what you do and who you help — the kind of thing people read in the first five seconds.",
              button_label: "Get in touch",
              button_page: "contact",
            }),
            block("stats", {
              items: [
                { value: "10+", label: "Years experience" },
                { value: "200+", label: "People helped" },
                { value: "5★", label: "Average rating" },
              ],
            }),
            block("text", {
              heading: "A bit about me",
              body: "Write your story here: what you do, how you got started, and why it matters to the people you work with.",
            }),
            block("reviews", {
              title: "What people say",
              items: [
                { quote: "Thoughtful, reliable and genuinely great to work with.", name: "A happy client", rating: 5 },
                { quote: "Made a real difference in a short amount of time.", name: "Another happy client", rating: 5 },
              ],
            }),
            block("newsletter", {
              title: "Stay in the loop",
              intro: "New work and the occasional update — no spam.",
              button_label: "Sign up",
              success: "You're on the list.",
            }),
          ]),
          {
            name: "About",
            path: "about",
            isHome: false,
            blocks: [
              block("text", { heading: "My story", body: "A longer version of your story goes here: your background, your approach, and what people can expect when they work with you." }),
              block("quote", { quote: "Do the work that matters, and the rest follows.", name: "Your name" }),
            ],
          },
          {
            name: "Contact",
            path: "contact",
            isHome: false,
            blocks: [
              block("text", { heading: "Let's talk", body: "Send a message and I'll get back to you within a day or two." }),
              block("contact_form", { title: "Get in touch", submit_label: "Send message", fields: CONTACT_FIELDS }),
            ],
          },
        ],
      };
    case "business":
      return {
        manifest: { ...manifest, background_color: "#f8f6ff" },
        theme: {
          ...theme,
          background_color: "#f8f6ff",
          bottom_nav_style: "tabs",
          bottom_nav: [
            { label: "Home", icon: "home", page_path: "home" },
            { label: "Visit", icon: "info", page_path: "visit" },
            { label: "Contact", icon: "mail", page_path: "contact" },
          ],
        },
        pages: [
          home([
            block("hero", {
              image_url: templatePhoto("business-hero"),
              eyebrow: "Locally owned · Since 2015",
              headline: "Your neighbourhood favourite.",
              subtext: "Fresh every morning, friendly faces every day. Come say hi, or order ahead from your phone.",
              button_label: "Plan your visit",
              button_page: "visit",
            }),
            block("stats", {
              items: [
                { value: "4.8★", label: "Local reviews" },
                { value: "7 days", label: "A week" },
                { value: "Free", label: "Wi-Fi" },
              ],
            }),
            block("text", {
              heading: "About us",
              body: "We're a small, family-run shop on the corner. Tell your story here: what you make, what you care about, and why the neighbourhood keeps coming back.",
            }),
            block("gallery", {
              title: "Take a look inside",
              images: [
                { src: templatePhoto("business-storefront"), alt: "Our storefront" },
                { src: templatePhoto("business-entrance"), alt: "The front door with plants" },
                { src: templatePhoto("business-case"), alt: "A display case of fresh treats" },
              ],
            }),
            block("reviews", {
              title: "What the neighbours say",
              items: [
                { quote: "My morning stop for three years. They know my order before I say it.", name: "Grace H.", rating: 5 },
                { quote: "Warm, welcoming and always something new to try.", name: "Omar F.", rating: 5 },
                { quote: "The kind of place every street should have.", name: "Beth C.", rating: 5 },
              ],
            }),
          ]),
          {
            name: "Visit",
            path: "visit",
            isHome: false,
            blocks: [
              block("hero", { image_url: templatePhoto("business-storefront"), eyebrow: "Come visit", headline: "We'd love to see you.", subtext: "Parking out front, and we're on the bus line." }),
              block("hours", {
                title: "Hours & location",
                rows: [
                  { label: "Mon to Fri", value: "7am to 6pm" },
                  { label: "Saturday", value: "8am to 5pm" },
                  { label: "Sunday", value: "8am to 2pm" },
                ],
                address: "",
                phone: "",
              }),
            ],
          },
          {
            name: "Contact",
            path: "contact",
            isHome: false,
            blocks: [block("contact_form", { title: "Get in touch", submit_label: "Send message", fields: CONTACT_FIELDS })],
          },
        ],
      };
    case "store":
      return {
        manifest: { ...manifest, background_color: "#faf7f2" },
        theme: {
          ...theme,
          background_color: "#faf7f2",
          bottom_nav_style: "tabs",
          bottom_nav: [
            { label: "Home", icon: "home", page_path: "home" },
            { label: "Shop", icon: "shop", page_path: "shop" },
            { label: "Contact", icon: "mail", page_path: "contact" },
          ],
        },
        pages: [
          home([
            block("hero", {
              image_url: templatePhoto("store-hero"),
              eyebrow: "Small batch · Made by hand",
              headline: "Little things that make a home.",
              subtext: "Hand-poured candles and home goods, made in small batches in our studio.",
              button_label: "Shop now",
              button_page: "shop",
            }),
            block("stats", {
              items: [
                { value: "100%", label: "Natural soy wax" },
                { value: "Free", label: "Local pickup" },
                { value: "4.9★", label: "From 300+ orders" },
              ],
            }),
            block("product_list", { title: "Bestsellers" }),
            block("gallery", {
              title: "From the studio",
              images: [
                { src: templatePhoto("store-shop"), alt: "Shelves of products in our shop" },
                { src: templatePhoto("store-amber"), alt: "A candle glowing in an amber jar" },
                { src: templatePhoto("store-set"), alt: "A set of scented candles on a wooden table" },
              ],
            }),
            block("reviews", {
              title: "Loved by customers",
              items: [
                { quote: "The cedar candle makes my whole apartment smell amazing. Already ordered two more.", name: "Hannah L.", rating: 5 },
                { quote: "Beautiful packaging, perfect gift. Picked it up the same day.", name: "Marcus P.", rating: 5 },
                { quote: "Burns clean and lasts forever. My favourite little shop.", name: "Ana R.", rating: 5 },
              ],
            }),
          ]),
          { name: "Shop", path: "shop", isHome: false, blocks: [block("text", { heading: "Shop everything", body: "Order from your phone and pay by card, or pick up for free at the studio." }), block("product_list", { title: "All products" })] },
          {
            name: "Contact",
            path: "contact",
            isHome: false,
            blocks: [
              block("hours", {
                title: "Studio hours",
                rows: [
                  { label: "Wed to Fri", value: "11am to 6pm" },
                  { label: "Saturday", value: "10am to 5pm" },
                  { label: "Sun to Tue", value: "Closed" },
                ],
                address: "",
                phone: "",
              }),
              block("contact_form", { title: "Questions or custom orders?", submit_label: "Send message", fields: CONTACT_FIELDS }),
            ],
          },
        ],
        products: [
          { name: "Cedar & Smoke candle", description: "Warm cedarwood and a hint of campfire. 8 oz, about 45 hours. (Sample product: edit it under Manage, Products.)", priceCents: 2800, image: templatePhoto("store-amber") },
          { name: "Gift set of four", description: "Four mini candles in our bestselling scents, ready to give. (Sample product.)", priceCents: 4800, image: templatePhoto("store-giftset") },
          { name: "Sunday Morning candle", description: "Fresh linen and orange blossom. 8 oz, about 45 hours. (Sample product.)", priceCents: 2600, image: templatePhoto("store-set") },
        ],
      };
    case "events":
      return {
        manifest: { ...manifest, background_color: "#faf5ff" },
        theme: {
          ...theme,
          background_color: "#faf5ff",
          bottom_nav_style: "tabs",
          bottom_nav: [
            { label: "Home", icon: "home", page_path: "home" },
            { label: "Events", icon: "calendar", page_path: "events" },
            { label: "Contact", icon: "mail", page_path: "contact" },
          ],
        },
        pages: [
          home([
            block("hero", {
              image_url: templatePhoto("events-hero"),
              eyebrow: "Tastings · Workshops · Live nights",
              headline: "Nights worth remembering.",
              subtext: "Small-group events with good people, great food and something new to learn. Save your spot in seconds.",
              button_label: "See upcoming events",
              button_page: "events",
            }),
            block("stats", {
              items: [
                { value: "12", label: "Events a month" },
                { value: "20", label: "Guests max" },
                { value: "98%", label: "Would come again" },
              ],
            }),
            block("event_calendar", { title: "Coming up" }),
            block("gallery", {
              title: "Past events",
              images: [
                { src: templatePhoto("events-cheers"), alt: "Guests raising a toast" },
                { src: templatePhoto("events-workshop"), alt: "Hands shaping clay at a pottery workshop" },
                { src: templatePhoto("events-toast"), alt: "Glasses raised in the sunshine" },
              ],
            }),
            block("reviews", {
              title: "Guests say",
              items: [
                { quote: "The wine and cheese night was so much fun. Booked the next one before I left.", name: "Natalie V.", rating: 5 },
                { quote: "Perfect for a date night. Small group, great hosts.", name: "Chris & Jo", rating: 5 },
                { quote: "I came alone and left with three new friends.", name: "Amir S.", rating: 5 },
              ],
            }),
            block("text", {
              heading: "Good to know",
              body: "Events start on time, so come 10 minutes early. Can't make it? Let us know and we'll offer your spot to someone on the list.",
            }),
          ]),
          { name: "Events", path: "events", isHome: false, blocks: [block("text", { heading: "All events", body: "Tap Book to save your spot. Spaces are limited." }), block("event_calendar", { title: "Upcoming" })] },
          {
            name: "Contact",
            path: "contact",
            isHome: false,
            blocks: [
              block("hours", { title: "Where we are", rows: [{ label: "Box office", value: "Wed to Sat, 12pm to 8pm" }], address: "", phone: "" }),
              block("contact_form", {
                title: "Private events and questions",
                submit_label: "Send message",
                fields: [
                  { name: "name", label: "Your name", type: "text", required: true },
                  { name: "email", label: "Email", type: "email", required: true },
                  { name: "message", label: "Tell us about your group or question", type: "textarea", required: true },
                ],
              }),
            ],
          },
        ],
        events: [
          { title: "Wine & cheese night", description: `Five wines, five cheeses and a host to guide you. ${SAMPLE_NOTE}`, dayOffset: 2, time: "19:00", minutes: 120, capacity: 20 },
          { title: "Beginner pottery workshop", description: `Make two pieces to take home. All materials included. ${SAMPLE_NOTE}`, dayOffset: 4, time: "18:00", minutes: 150, capacity: 12 },
          { title: "Live acoustic evening", description: `Local songwriters, candlelight and a full bar. ${SAMPLE_NOTE}`, dayOffset: 6, time: "20:00", minutes: 120, capacity: 40 },
          { title: "Cocktail masterclass", description: `Shake three classic cocktails with our bartender. ${SAMPLE_NOTE}`, dayOffset: 9, time: "19:30", minutes: 90, capacity: 16 },
        ],
      };
    case "food":
      return { manifest, theme, pages: [home([block("food_directory")])] };
    case "gas":
      return { manifest, theme, pages: [home([block("gas_directory")])] };
    case "restaurant":
      return {
        manifest: { ...manifest, background_color: "#fff8f1" },
        theme: {
          ...theme,
          background_color: "#fff8f1",
          bottom_nav_style: "tabs",
          bottom_nav: [
            { label: "Home", icon: "home", page_path: "home" },
            { label: "Menu", icon: "info", page_path: "menu" },
            { label: "Reserve", icon: "calendar", page_path: "reserve" },
          ],
        },
        pages: [
          home([
            block("hero", {
              image_url: templatePhoto("restaurant-hero"),
              eyebrow: "Fresh · Local · Made to order",
              headline: "Good food, made with love.",
              subtext: "Tacos, bowls and fresh salsas, made from scratch every morning.",
              button_label: "Reserve a table",
              button_page: "reserve",
            }),
            block("stats", {
              items: [
                { value: "Daily", label: "Fresh salsas" },
                { value: "15 min", label: "Pickup orders" },
                { value: "Family", label: "Run since 2019" },
              ],
            }),
            block("gallery", {
              title: "Come hungry",
              images: [
                { src: templatePhoto("restaurant-room"), alt: "Our dining room with warm string lights" },
                { src: templatePhoto("restaurant-latte"), alt: "A latte on a bright orange table" },
                { src: templatePhoto("restaurant-cafe"), alt: "A cozy corner of the café" },
              ],
            }),
            block("reviews", {
              title: "Regulars say it best",
              items: [
                { quote: "The carnitas tacos are the best in the neighbourhood. We come every Friday.", name: "Maria G.", rating: 5 },
                { quote: "Friendly staff, quick lunch, and the salsa bar is unreal.", name: "Daniel K.", rating: 5 },
                { quote: "Booked a table for 8 from the app in a minute. Loved it.", name: "Priya S.", rating: 5 },
              ],
            }),
            block("hours", {
              title: "Hours",
              rows: [
                { label: "Mon to Thu", value: "11am to 9pm" },
                { label: "Fri and Sat", value: "11am to 10pm" },
                { label: "Sunday", value: "10am to 3pm (brunch)" },
              ],
              address: "",
              phone: "",
            }),
          ]),
          {
            name: "Menu",
            path: "menu",
            isHome: false,
            blocks: [
              block("price_list", {
                title: "Menu",
                subtitle: "Everything is made fresh. Ask us about gluten-free and vegan options.",
                sections: [
                  {
                    name: "Tacos",
                    items: [
                      { name: "Carnitas", description: "Slow-cooked pork, pickled onion, cilantro", price: "$4.50", badge: "Popular" },
                      { name: "Baja fish", description: "Crispy cod, chipotle crema, cabbage slaw", price: "$5.00" },
                      { name: "Roasted cauliflower", description: "Pepita salsa, lime, queso fresco", price: "$4.00", badge: "Veggie" },
                    ],
                  },
                  {
                    name: "Bowls & salads",
                    items: [
                      { name: "Burrito bowl", description: "Rice, black beans, your choice of protein, all the toppings", price: "$13" },
                      { name: "Street corn salad", description: "Charred corn, cotija, lime, chili", price: "$9" },
                    ],
                  },
                  {
                    name: "Drinks",
                    items: [
                      { name: "Horchata", description: "House-made, cinnamon and rice", price: "$4" },
                      { name: "Latte", description: "Double shot, any milk", price: "$5" },
                    ],
                  },
                ],
              }),
            ],
          },
          {
            name: "Reserve",
            path: "reserve",
            isHome: false,
            blocks: [
              block("contact_form", {
                title: "Reserve a table",
                submit_label: "Request a table",
                fields: [
                  { name: "name", label: "Your name", type: "text", required: true },
                  { name: "email", label: "Email", type: "email", required: true },
                  { name: "details", label: "Day, time and number of people", type: "textarea", required: true },
                ],
              }),
            ],
          },
        ],
      };
    case "fitness":
      return {
        manifest: { ...manifest, background_color: "#0a0a0a" },
        theme: {
          ...theme,
          color_scheme: "dark",
          background_color: "#0a0a0a",
          bottom_nav_style: "tabs",
          bottom_nav: [
            { label: "Home", icon: "home", page_path: "home" },
            { label: "Classes", icon: "calendar", page_path: "classes" },
            { label: "Join", icon: "user", page_path: "join" },
          ],
        },
        pages: [
          home([
            block("hero", {
              image_url: templatePhoto("gym-hero"),
              eyebrow: "Strength · Yoga · Martial arts",
              headline: "Stronger every week.",
              subtext: "Coached classes for every level, from first-timers to competitors. Your first class is on us.",
              button_label: "Book a free class",
              button_page: "classes",
            }),
            block("stats", {
              items: [
                { value: "20+", label: "Classes a week" },
                { value: "All", label: "Levels welcome" },
                { value: "1st", label: "Class free" },
              ],
            }),
            block("price_list", {
              title: "Memberships",
              subtitle: "No sign-up fees. Pause or cancel any time.",
              sections: [
                {
                  name: "Plans",
                  items: [
                    { name: "Drop-in class", description: "Any class, no commitment", price: "$20" },
                    { name: "10-class pass", description: "Use within 3 months", price: "$170", badge: "Save 15%" },
                    { name: "Unlimited", description: "Every class, every week", price: "$129/mo", badge: "Most popular" },
                  ],
                },
              ],
            }),
            block("gallery", {
              title: "Inside the studio",
              images: [
                { src: templatePhoto("gym-yoga"), alt: "A member stretching on a yoga mat" },
                { src: templatePhoto("gym-karate"), alt: "A young student in a karate uniform" },
                { src: templatePhoto("gym-weights"), alt: "A rack of dumbbells" },
              ],
            }),
            block("reviews", {
              title: "Members say",
              items: [
                { quote: "I was nervous to start, but the coaches made my first class feel easy. Six months in and I'm hooked.", name: "Jordan T.", rating: 5 },
                { quote: "My kids love their karate class, and I love that I can book it from my phone.", name: "Alicia M.", rating: 5 },
                { quote: "Best community in town. The 6am crew keeps me honest.", name: "Sam R.", rating: 5 },
              ],
            }),
            block("hours", {
              title: "Hours",
              rows: [
                { label: "Mon to Fri", value: "6am to 9pm" },
                { label: "Saturday", value: "8am to 4pm" },
                { label: "Sunday", value: "9am to 1pm" },
              ],
              address: "",
              phone: "",
            }),
          ]),
          {
            name: "Classes",
            path: "classes",
            isHome: false,
            blocks: [
              block("text", { heading: "Book a class", body: "Pick a class and save your spot. New here? Your first class is free." }),
              block("event_calendar", { title: "This week" }),
            ],
          },
          {
            name: "Join",
            path: "join",
            isHome: false,
            blocks: [
              block("hero", {
                image_url: templatePhoto("gym-karate"),
                eyebrow: "New members",
                headline: "Your first class is free.",
                subtext: "Tell us a little about you and we'll save you a spot.",
              }),
              block("contact_form", {
                title: "Claim your free class",
                submit_label: "Claim my free class",
                fields: [
                  { name: "name", label: "Your name", type: "text", required: true },
                  { name: "email", label: "Email", type: "email", required: true },
                  { name: "goal", label: "What are you hoping to get out of it?", type: "textarea" },
                ],
              }),
            ],
          },
        ],
        events: [
          { title: "Morning Strength", description: `Full-body strength with a coach. All levels. ${SAMPLE_NOTE}`, dayOffset: 1, time: "06:30", minutes: 45, capacity: 16 },
          { title: "Beginner Karate (kids 7 to 12)", description: `Fun, focused and safe. Uniforms not needed for your first class. ${SAMPLE_NOTE}`, dayOffset: 1, time: "17:30", minutes: 50, capacity: 14 },
          { title: "Vinyasa Yoga", description: `Flow, breathe and stretch. Mats provided. ${SAMPLE_NOTE}`, dayOffset: 2, time: "18:00", minutes: 60, capacity: 20 },
          { title: "HIIT 30", description: `Thirty minutes, all out. ${SAMPLE_NOTE}`, dayOffset: 3, time: "12:15", minutes: 30, capacity: 18 },
          { title: "Adult Karate", description: `Technique, sparring drills and conditioning. ${SAMPLE_NOTE}`, dayOffset: 4, time: "19:00", minutes: 60, capacity: 16 },
          { title: "Weekend Bootcamp", description: `Bring a friend. Outdoor if the weather is good. ${SAMPLE_NOTE}`, dayOffset: 5, time: "09:00", minutes: 60, capacity: 24 },
        ],
      };
    case "salon":
      return {
        manifest: { ...manifest, background_color: "#fdf6f4" },
        theme: {
          ...theme,
          background_color: "#fdf6f4",
          bottom_nav_style: "tabs",
          bottom_nav: [
            { label: "Home", icon: "home", page_path: "home" },
            { label: "Services", icon: "info", page_path: "services" },
            { label: "Book", icon: "calendar", page_path: "book" },
          ],
        },
        pages: [
          home([
            block("hero", {
              image_url: templatePhoto("salon-hero"),
              eyebrow: "Hair · Colour · Styling",
              headline: "Leave feeling like you.",
              subtext: "Cuts, colour and styling by a team that listens first. Book in seconds from your phone.",
              button_label: "Book an appointment",
              button_page: "book",
            }),
            block("stats", {
              items: [
                { value: "4.9★", label: "200+ reviews" },
                { value: "12 yrs", label: "Experience" },
                { value: "Same", label: "Week booking" },
              ],
            }),
            block("gallery", {
              title: "Inside the salon",
              images: [
                { src: templatePhoto("salon-interior"), alt: "Our bright salon with round mirrors" },
                { src: templatePhoto("salon-blowdry"), alt: "A stylist giving a blow-dry" },
                { src: templatePhoto("salon-wash"), alt: "A relaxing hair wash" },
              ],
            }),
            block("reviews", {
              title: "Happy clients",
              items: [
                { quote: "Best colour I've ever had. They actually listened to what I wanted.", name: "Chloe W.", rating: 5 },
                { quote: "Booked from the app on my lunch break and was in the chair two days later.", name: "Tasha B.", rating: 5 },
                { quote: "Relaxing, friendly and my cut still looks great a month later.", name: "Emily J.", rating: 5 },
              ],
            }),
            block("hours", {
              title: "Hours",
              rows: [
                { label: "Tue to Fri", value: "10am to 7pm" },
                { label: "Saturday", value: "9am to 5pm" },
                { label: "Sun and Mon", value: "Closed" },
              ],
              address: "",
              phone: "",
            }),
          ]),
          {
            name: "Services",
            path: "services",
            isHome: false,
            blocks: [
              block("price_list", {
                title: "Services",
                subtitle: "Prices are a starting point and depend on hair length. We'll confirm at your consultation.",
                sections: [
                  {
                    name: "Cuts",
                    items: [
                      { name: "Women's cut & style", description: "Wash, cut and blow-dry, about 60 minutes", price: "from $65", badge: "Popular" },
                      { name: "Men's cut", description: "Wash, cut and style, about 30 minutes", price: "from $40" },
                      { name: "Kids' cut", description: "Under 12", price: "$30" },
                    ],
                  },
                  {
                    name: "Colour",
                    items: [
                      { name: "Full colour", description: "Root to tip, includes toner", price: "from $110" },
                      { name: "Balayage", description: "Hand-painted, natural-looking highlights", price: "from $180", badge: "Signature" },
                      { name: "Root touch-up", description: "Up to 6 weeks of regrowth", price: "from $75" },
                    ],
                  },
                  {
                    name: "Styling",
                    items: [
                      { name: "Blow-dry", description: "Smooth, bouncy or beach waves", price: "$45" },
                      { name: "Event hair", description: "Weddings, parties and photoshoots", price: "from $85" },
                    ],
                  },
                ],
              }),
            ],
          },
          {
            name: "Book",
            path: "book",
            isHome: false,
            blocks: [
              block("text", { heading: "Book an appointment", body: "Pick a time that suits you. Need something different? Send us a message below." }),
              block("event_calendar", { title: "Open appointments" }),
              block("contact_form", { title: "Ask a question", submit_label: "Send message", fields: CONTACT_FIELDS }),
            ],
          },
        ],
        events: [
          { title: "Cut & style with Mia", description: `60 minutes. ${SAMPLE_NOTE}`, dayOffset: 1, time: "10:00", minutes: 60, capacity: 1 },
          { title: "Colour consultation", description: `Free, 20 minutes. Find the right shade for you. ${SAMPLE_NOTE}`, dayOffset: 1, time: "14:30", minutes: 20, capacity: 1 },
          { title: "Balayage with Jordan", description: `About 3 hours. ${SAMPLE_NOTE}`, dayOffset: 2, time: "11:00", minutes: 180, capacity: 1 },
          { title: "Blow-dry", description: `45 minutes. ${SAMPLE_NOTE}`, dayOffset: 3, time: "16:00", minutes: 45, capacity: 1 },
          { title: "Men's cut with Leo", description: `30 minutes. ${SAMPLE_NOTE}`, dayOffset: 4, time: "12:00", minutes: 30, capacity: 1 },
        ],
      };
    case "community":
      return {
        manifest: { ...manifest, background_color: "#f3faf8" },
        theme: {
          ...theme,
          background_color: "#f3faf8",
          bottom_nav_style: "tabs",
          bottom_nav: [
            { label: "Home", icon: "home", page_path: "home" },
            { label: "Events", icon: "calendar", page_path: "events" },
            { label: "Join", icon: "user", page_path: "join" },
          ],
        },
        pages: [
          home([
            block("hero", {
              image_url: templatePhoto("community-hero"),
              eyebrow: "Neighbours · Friends · Volunteers",
              headline: "Better together.",
              subtext: "Meetups, workshops and good causes, all in one place. Everyone is welcome.",
              button_label: "See what's on",
              button_page: "events",
            }),
            block("stats", {
              items: [
                { value: "250+", label: "Members" },
                { value: "4", label: "Events a month" },
                { value: "Free", label: "To join" },
              ],
            }),
            block("text", {
              heading: "What we're about",
              body: "We're a friendly group of neighbours who like to meet, learn and help out. Come to one event, bring a friend, and stay as long as you like.",
            }),
            block("gallery", {
              title: "Recent gatherings",
              images: [
                { src: templatePhoto("community-workshop"), alt: "Members at a hands-on workshop" },
                { src: templatePhoto("community-market"), alt: "Neighbours chatting at a market day" },
                { src: templatePhoto("community-volunteers"), alt: "Volunteers at a community drive" },
              ],
            }),
            block("reviews", {
              title: "Why members stay",
              items: [
                { quote: "I moved here not knowing anyone. Six months later this group feels like family.", name: "Rosa D.", rating: 5 },
                { quote: "The book circle is the highlight of my month.", name: "Ken O.", rating: 5 },
                { quote: "Easy to find out what's on and sign up right from my phone.", name: "Liz M.", rating: 5 },
              ],
            }),
          ]),
          {
            name: "Events",
            path: "events",
            isHome: false,
            blocks: [
              block("text", { heading: "Coming up", body: "Save your spot so we know how many to expect." }),
              block("event_calendar", { title: "Upcoming events" }),
            ],
          },
          {
            name: "Join",
            path: "join",
            isHome: false,
            blocks: [
              block("hero", {
                image_url: templatePhoto("community-books"),
                eyebrow: "Membership is free",
                headline: "Come join us.",
                subtext: "Get news and event reminders. No commitment, ever.",
              }),
              block("contact_form", {
                title: "Join the community",
                submit_label: "Count me in",
                fields: [
                  { name: "name", label: "Your name", type: "text", required: true },
                  { name: "email", label: "Email", type: "email", required: true },
                  { name: "interests", label: "What are you interested in?", type: "textarea" },
                ],
              }),
            ],
          },
        ],
        events: [
          { title: "Monthly book circle", description: `This month: anything you loved reading lately. ${SAMPLE_NOTE}`, dayOffset: 2, time: "19:00", minutes: 90, capacity: 20 },
          { title: "Saturday park clean-up", description: `Gloves and bags provided. Coffee after. ${SAMPLE_NOTE}`, dayOffset: 5, time: "10:00", minutes: 120, capacity: 40 },
          { title: "Wreath-making workshop", description: `All materials included. ${SAMPLE_NOTE}`, dayOffset: 9, time: "18:30", minutes: 120, capacity: 16 },
          { title: "Neighbourhood potluck", description: `Bring a dish to share. Families welcome. ${SAMPLE_NOTE}`, dayOffset: 13, time: "17:00", minutes: 180, capacity: 60 },
        ],
      };
    case "openmic":
      return {
        manifest: { ...manifest, background_color: "#09090b" },
        theme: {
          ...theme,
          color_scheme: "dark",
          background_color: "#09090b",
          bottom_nav_style: "tabs",
          bottom_nav: [
            { label: "Tonight", icon: "home", page_path: "home" },
            { label: "Add your mic", icon: "plus", page_path: "add-mic" },
          ],
        },
        pages: [
          home([
            block("hero", {
              image_url: templatePhoto("openmic-hero"),
              eyebrow: "Comedy · Music · Poetry",
              headline: "Find your stage tonight.",
              subtext: "Every open mic in town, sorted by start time, with sign-up details and directions.",
              button_label: "Host a mic? Add it",
              button_page: "add-mic",
            }),
            block("stats", {
              items: [
                { value: "7", label: "Nights a week" },
                { value: "Free", label: "Most mics" },
                { value: "All", label: "Levels" },
              ],
            }),
            block("listing_directory"),
            block("gallery", {
              title: "The scene",
              images: [
                { src: templatePhoto("openmic-brick"), alt: "A microphone against a brick wall" },
                { src: templatePhoto("openmic-mic"), alt: "A vintage microphone under stage lights" },
                { src: templatePhoto("openmic-neon"), alt: "A neon sign that says yes, and" },
              ],
            }),
            block("reviews", {
              title: "Performers say",
              items: [
                { quote: "I check this every night before I head out. Saves me so much time.", name: "Dev P., comic", rating: 5 },
                { quote: "Found my first ever mic here. Now I'm up three nights a week.", name: "Sara L., songwriter", rating: 5 },
              ],
            }),
          ]),
          {
            name: "Add your mic",
            path: "add-mic",
            isHome: false,
            blocks: [
              block("hero", { image_url: templatePhoto("openmic-brick"), eyebrow: "For hosts", headline: "Put your mic on the map.", subtext: "Free to list. We'll check the details and add it within a day." }),
              block("contact_form", {
                title: "Submit your open mic",
                submit_label: "Send it in",
                fields: [
                  { name: "mic_name", label: "Open mic name", type: "text", required: true },
                  { name: "venue", label: "Venue and address", type: "text", required: true },
                  { name: "schedule", label: "Day and time", type: "text", required: true },
                  { name: "email", label: "Your email", type: "email", required: true },
                ],
              }),
            ],
          },
        ],
        listings: [
          { slug: "sample-early-laughs", record: sampleMic("sample-early-laughs", "Early Laughs Comedy Mic", "The Corner Pub", "6:30pm/7pm", "Comedy", "monday,wednesday,friday,saturday", "5 minutes each. Sign up in person.") },
          { slug: "sample-songbird", record: sampleMic("sample-songbird", "Songbird Acoustic Night", "Harbor Café", "7pm/7:30pm", "Music", "tuesday,thursday,sunday", "Two songs each. Bring your own instrument.") },
          { slug: "sample-mixed-bag", record: sampleMic("sample-mixed-bag", "Mixed Bag Variety Mic", "Lantern Lounge", "8pm/8:30pm", "Music & Comedy", "monday,tuesday,wednesday,thursday,friday,saturday,sunday", "Comedy, music, poetry, anything goes.") },
          { slug: "sample-late-night", record: sampleMic("sample-late-night", "Late Night Laugh Lab", "Basement Theatre", "9:30pm/10pm", "Comedy", "tuesday,thursday,friday,saturday", "7 minutes. Online sign-up opens at noon.") },
          { slug: "sample-poetry", record: sampleMic("sample-poetry", "Spoken Word Sundays", "Book & Bean", "6pm/6:30pm", "Poetry", "sunday,wednesday", "Poems, stories and spoken word.") },
        ],
      };
    case "byob":
      // A code app: its pages are empty (the app is the React code); the AI writes the files.
      return { manifest, theme, pages: [home([])], codeFiles: starterFiles(appName) };
    default:
      return { manifest, theme: {}, pages: [home([])] };
  }
}
