// Categories and group icons. Both are line icons in a neutral tile, the way
// Dueline draws its rows; nothing here is an emoji any more.

import { svg } from "./icons.js";

export const CATS = [
  { id: "food", label: "Food", icon: "utensils" },
  { id: "groceries", label: "Groceries", icon: "cart" },
  { id: "drinks", label: "Drinks", icon: "wine" },
  { id: "travel", label: "Travel", icon: "taxi" },
  { id: "fuel", label: "Fuel", icon: "fuel" },
  { id: "stay", label: "Stay", icon: "bed" },
  { id: "rent", label: "Rent", icon: "house" },
  { id: "bills", label: "Bills", icon: "zap" },
  { id: "tickets", label: "Tickets", icon: "ticket" },
  { id: "fun", label: "Fun", icon: "film" },
  { id: "shopping", label: "Shopping", icon: "bag" },
  { id: "gifts", label: "Gifts", icon: "gift" },
  { id: "health", label: "Health", icon: "health" },
  { id: "other", label: "Other", icon: "receipt" },
];
export const catOf = (id) => CATS.find((c) => c.id === id) ?? CATS[CATS.length - 1];
export const catIcon = (id) => svg(catOf(id).icon);

// Group icons are stored by id in the group's `emoji` field (the field keeps
// its old name so existing backups and shared groups stay valid).
export const GROUP_ICONS = [
  { id: "trip", label: "Trip", icon: "palm" },
  { id: "home", label: "Home", icon: "house" },
  { id: "food", label: "Food", icon: "pizza" },
  { id: "party", label: "Party", icon: "party" },
  { id: "flight", label: "Flight", icon: "plane" },
  { id: "hills", label: "Hills", icon: "mountain" },
  { id: "roadtrip", label: "Road trip", icon: "car" },
  { id: "movies", label: "Movies", icon: "film" },
  { id: "work", label: "Work", icon: "briefcase" },
  { id: "couple", label: "Couple", icon: "heart" },
  { id: "person", label: "One person", icon: "person" },
  { id: "ledger", label: "Ledger", icon: "receipt" },
];
const LEGACY = {
  "🏝️": "trip", "🏝": "trip", "🏠": "home", "🍕": "food", "🎉": "party",
  "✈️": "flight", "✈": "flight", "🎬": "movies", "🏔️": "hills", "🏔": "hills",
  "💼": "work", "🧾": "ledger",
};
export const groupIconId = (value) => {
  if (GROUP_ICONS.some((g) => g.id === value)) return value;
  return LEGACY[value] ?? "ledger";
};
export const groupIcon = (group) =>
  svg(GROUP_ICONS.find((g) => g.id === groupIconId(group?.emoji))?.icon ?? "receipt");

// Words people actually type, English and Hinglish, with the Indian apps and
// brands that name a category on their own. The earliest match in the text
// wins, so "Cab to the hotel" is travel and "Dinner at the hotel" is food.
const WORDS = [
  ["health", /\b(medicines?|pharmacy|chemist|doctor|hospital|clinic|apollo|1mg|pharmeasy|dental|dentist|lab test|dawai)\b/],
  ["gifts", /\b(gifts?|birthday|present|anniversary|wedding|shagun)\b/],
  ["fuel", /\b(petrol|diesel|fuel|cng|ev charg\w*|gas station)\b/],
  ["drinks", /\b(beers?|wine|whisky|whiskey|vodka|rum|drinks|bar|pub|liquor|daaru|daru|theka|cocktails?|brewery)\b/],
  ["groceries", /\b(grocer\w*|blinkit|zepto|bigbasket|instamart|dmart|vegetables|sabzi|fruits?|milk|doodh|kirana|ration|supermarket)\b/],
  ["food", /\b(dinner|lunch|breakfast|brunch|food|meals?|restaurant|cafe|café|zomato|swiggy|pizza|burgers?|biryani|thali|dhaba|snacks|chai|tea|coffee|maggi|momos|dominos|kfc|mcdonald\w*|starbucks|bakery|dessert|ice ?cream|sweets|mithai|khana|street food|chaat)\b/],
  ["stay", /\b(hotel|hostel|airbnb|oyo|stay|resort|homestay|villa|guest ?house|booking\.com)\b/],
  ["rent", /\b(rent|kiraya|maintenance|deposit|society|pg)\b/],
  ["fun", /\b(movies?|cinema|pvr|inox|netflix|spotify|prime video|hotstar|games?|gaming|bowling|club|party|karaoke|arcade|concert)\b/],
  ["tickets", /\b(tickets?|entry|museum|fort|show|pass|bookmyshow|zoo|safari)\b/],
  ["travel", /\b(uber|ola|rapido|cab|taxi|auto|rickshaw|metro|train|irctc|bus|flights?|airport|indigo|air india|vistara|akasa|spicejet|toll|ferry|boat|cruise|parking|scooty|bike rental|travel)\b/],
  ["bills", /\b(electricity|bijli|wi-?fi|internet|broadband|jio|airtel|recharge|phone bill|water bill|gas bill|lpg|cylinder|dth)\b/],
  ["shopping", /\b(shopping|amazon|flipkart|myntra|ajio|nykaa|meesho|clothes|shoes|mall|decathlon)\b/],
];

export function guessCategory(text) {
  const s = String(text ?? "").toLowerCase();
  let best = null;
  for (const [id, re] of WORDS) {
    const m = re.exec(s);
    if (m && (best === null || m.index < best.index)) best = { id, index: m.index };
  }
  return best?.id ?? null;
}

// Splitwise's category names, for the CSV import.
const SPLITWISE = {
  food: ["dining out", "food and drink", "food"],
  groceries: ["groceries"],
  drinks: ["liquor"],
  travel: ["taxi", "bus/train", "plane", "car", "bicycle", "parking", "transportation", "hotel & travel"],
  fuel: ["gas/fuel"],
  stay: ["hotel"],
  rent: ["rent", "mortgage", "household supplies", "maintenance", "home", "furniture", "services", "pets"],
  bills: ["electricity", "heat/gas", "water", "tv/phone/internet", "utilities", "trash", "cleaning"],
  fun: ["entertainment", "games", "movies", "music", "sports"],
  shopping: ["clothing", "electronics"],
  gifts: ["gifts"],
  health: ["medical expenses", "insurance"],
};
export function fromSplitwiseCategory(name) {
  const key = String(name ?? "").trim().toLowerCase();
  for (const [id, names] of Object.entries(SPLITWISE)) if (names.includes(key)) return id;
  return null;
}
