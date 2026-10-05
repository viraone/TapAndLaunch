import type { CuisineKey } from "@/types/database";

/**
 * "Popular with diners": which well-known dishes a restaurant's recent positive reviews mention.
 * Matching a built-in dish list per cuisine keeps this free and predictable (no AI service to pay
 * for, nothing invented: a dish only shows up if a reviewer actually wrote it).
 */
export interface Dish {
  name: string;
  emoji: string;
  /** Lower-case, accent-free phrases; any one in a review counts as a mention. */
  aliases: string[];
}

const d = (name: string, emoji: string, ...aliases: string[]): Dish => ({ name, emoji, aliases });

export const DISH_LISTS: Record<CuisineKey, Dish[]> = {
  ramen: [
    d("Tonkotsu ramen", "🍜", "tonkotsu"),
    d("Shoyu ramen", "🍜", "shoyu"),
    d("Miso ramen", "🍜", "miso ramen", "spicy miso"),
    d("Spicy ramen", "🌶️", "spicy ramen", "spicy tonkotsu"),
    d("Tantanmen", "🍜", "tantanmen", "tan tan"),
    d("Tsukemen", "🍜", "tsukemen", "dipping ramen"),
    d("Black garlic ramen", "🍜", "black garlic"),
    d("Gyoza", "🥟", "gyoza", "potsticker"),
    d("Karaage", "🍗", "karaage"),
    d("Chashu", "🥩", "chashu", "char siu"),
    d("Takoyaki", "🐙", "takoyaki"),
  ],
  vietnamese: [
    d("Pho", "🍜", "pho"),
    d("Pho dac biet", "🍜", "dac biet", "special combo"),
    d("Bun bo Hue", "🍜", "bun bo hue"),
    d("Banh mi", "🥖", "banh mi"),
    d("Spring rolls", "🥬", "spring roll", "summer roll", "goi cuon"),
    d("Vermicelli bowl", "🍜", "vermicelli", "bun thit nuong", "bun cha"),
    d("Broken rice", "🍚", "com tam", "broken rice"),
    d("Egg rolls", "🥟", "egg roll", "cha gio"),
    d("Banh xeo", "🥞", "banh xeo"),
    d("Vietnamese coffee", "☕", "vietnamese coffee", "ca phe"),
  ],
  thai: [
    d("Pad Thai", "🍜", "pad thai"),
    d("Green curry", "🍛", "green curry"),
    d("Red curry", "🍛", "red curry"),
    d("Panang curry", "🍛", "panang"),
    d("Massaman curry", "🍛", "massaman"),
    d("Tom yum", "🍲", "tom yum"),
    d("Tom kha", "🍲", "tom kha"),
    d("Pad see ew", "🍜", "pad see ew", "pad see eew"),
    d("Drunken noodles", "🍜", "drunken noodle", "pad kee mao"),
    d("Papaya salad", "🥗", "papaya salad", "som tum"),
    d("Mango sticky rice", "🥭", "mango sticky"),
    d("Thai iced tea", "🧋", "thai iced tea", "thai tea"),
  ],
  korean: [
    d("Bibimbap", "🍚", "bibimbap"),
    d("Korean fried chicken", "🍗", "fried chicken"),
    d("Bulgogi", "🥩", "bulgogi"),
    d("Korean BBQ", "🥩", "galbi", "kalbi", "korean bbq", "kbbq"),
    d("Kimchi jjigae", "🍲", "kimchi jjigae", "kimchi stew", "jjigae"),
    d("Soft tofu stew", "🍲", "soon tofu", "sundubu", "tofu stew"),
    d("Japchae", "🍜", "japchae"),
    d("Tteokbokki", "🌶️", "tteokbokki", "topokki"),
    d("Kimbap", "🍙", "kimbap", "gimbap"),
    d("Dumplings", "🥟", "mandu", "dumpling"),
    d("Cold noodles", "🍜", "naengmyeon"),
  ],
  japanese: [
    d("Sushi", "🍣", "sushi", "nigiri"),
    d("Sashimi", "🐟", "sashimi"),
    d("Chirashi", "🍚", "chirashi"),
    d("Omakase", "🍣", "omakase"),
    d("Teriyaki", "🍗", "teriyaki"),
    d("Udon", "🍜", "udon"),
    d("Tempura", "🍤", "tempura"),
    d("Katsu", "🍛", "katsu", "tonkatsu"),
    d("Unagi", "🍣", "unagi"),
    d("Dragon roll", "🍣", "dragon roll"),
    d("Yakitori", "🍢", "yakitori"),
    d("Gyoza", "🥟", "gyoza"),
  ],
  mexican: [
    d("Tacos", "🌮", "taco"),
    d("Al pastor", "🌮", "al pastor"),
    d("Carne asada", "🥩", "carne asada"),
    d("Carnitas", "🥩", "carnitas"),
    d("Birria", "🌮", "birria"),
    d("Fish tacos", "🌮", "fish taco"),
    d("Burrito", "🌯", "burrito"),
    d("Quesadilla", "🧀", "quesadilla"),
    d("Nachos", "🧀", "nachos"),
    d("Enchiladas", "🌯", "enchilada"),
    d("Tamales", "🫔", "tamale"),
    d("Guacamole", "🥑", "guacamole", "guac"),
    d("Churros", "🍩", "churro"),
    d("Margarita", "🍹", "margarita"),
    d("Elote", "🌽", "elote", "street corn"),
  ],
  pizza: [
    d("Margherita", "🍕", "margherita"),
    d("Pepperoni", "🍕", "pepperoni"),
    d("White pizza", "🍕", "white pizza"),
    d("Deep dish", "🍕", "deep dish"),
    d("Hawaiian", "🍍", "hawaiian"),
    d("Calzone", "🥟", "calzone"),
    d("Garlic knots", "🧄", "garlic knot"),
    d("Wings", "🍗", "wings"),
    d("Pasta", "🍝", "pasta"),
    d("Meatballs", "🍝", "meatball"),
    d("Tiramisu", "🍰", "tiramisu"),
  ],
  burgers: [
    d("Cheeseburger", "🍔", "cheeseburger"),
    d("Bacon burger", "🥓", "bacon burger", "bacon cheeseburger"),
    d("Fries", "🍟", "fries"),
    d("Tater tots", "🍟", "tater tot", "tots"),
    d("Milkshake", "🥤", "milkshake"),
    d("Onion rings", "🧅", "onion ring"),
    d("Chicken sandwich", "🍗", "chicken sandwich"),
    d("Veggie burger", "🥬", "veggie burger", "impossible burger"),
    d("Hot dog", "🌭", "hot dog"),
  ],
  mediterranean: [
    d("Gyro", "🥙", "gyro"),
    d("Falafel", "🧆", "falafel"),
    d("Shawarma", "🥙", "shawarma"),
    d("Kebab", "🍢", "kebab", "kabob"),
    d("Hummus", "🫓", "hummus"),
    d("Baba ghanoush", "🍆", "baba ghanoush", "baba ganoush"),
    d("Tzatziki", "🥒", "tzatziki"),
    d("Dolma", "🍃", "dolma"),
    d("Lamb", "🥩", "lamb"),
    d("Baklava", "🍯", "baklava"),
  ],
  ethiopian: [
    d("Injera", "🫓", "injera"),
    d("Doro wat", "🍗", "doro wat", "doro wot"),
    d("Tibs", "🥩", "tibs"),
    d("Kitfo", "🥩", "kitfo"),
    d("Veggie combo", "🥬", "veggie combo", "vegetarian combo", "vegetarian platter"),
    d("Shiro", "🍲", "shiro"),
    d("Misir wat", "🍲", "misir"),
    d("Gomen", "🥬", "gomen"),
  ],
  indian: [
    d("Butter chicken", "🍛", "butter chicken"),
    d("Chicken tikka masala", "🍛", "tikka masala"),
    d("Biryani", "🍚", "biryani"),
    d("Naan", "🫓", "naan"),
    d("Samosas", "🥟", "samosa"),
    d("Saag paneer", "🥬", "saag", "palak paneer"),
    d("Chana masala", "🍲", "chana"),
    d("Dosa", "🥞", "dosa"),
    d("Tandoori", "🍗", "tandoori"),
    d("Vindaloo", "🌶️", "vindaloo"),
    d("Mango lassi", "🥭", "lassi"),
  ],
  bars: [
    d("Wings", "🍗", "wings"),
    d("Burger", "🍔", "burger"),
    d("Fries", "🍟", "fries"),
    d("Nachos", "🧀", "nachos"),
    d("Fish and chips", "🐟", "fish and chips", "fish & chips"),
    d("Mac and cheese", "🧀", "mac and cheese", "mac & cheese"),
    d("Pretzel", "🥨", "pretzel"),
    d("Sliders", "🍔", "slider"),
    d("Chicken tenders", "🍗", "tenders"),
    d("Poutine", "🍟", "poutine"),
  ],
  healthy: [
    d("Açaí bowl", "🫐", "acai", "açaí"),
    d("Smoothie", "🥤", "smoothie"),
    d("Green smoothie", "🥬", "green smoothie"),
    d("Fresh juice", "🧃", "fresh juice", "cold-pressed", "cold pressed"),
    d("Caesar salad", "🥗", "caesar"),
    d("Cobb salad", "🥗", "cobb"),
    d("Kale salad", "🥬", "kale"),
    d("Grain bowl", "🍚", "grain bowl", "buddha bowl", "power bowl"),
    d("Poke bowl", "🍣", "poke"),
    d("Avocado toast", "🥑", "avocado toast"),
    d("Wrap", "🌯", "wrap"),
    d("Protein shake", "💪", "protein shake", "protein smoothie"),
  ],
  taiwanese: [
    d("Beef noodle soup", "🍜", "beef noodle"),
    d("Soup dumplings", "🥟", "xiao long bao", "soup dumpling", "xlb"),
    d("Dumplings", "🥟", "dumpling", "potsticker", "pot sticker"),
    d("Popcorn chicken", "🍗", "popcorn chicken"),
    d("Gua bao", "🥟", "gua bao", "pork belly bun"),
    d("Braised pork rice", "🍚", "lu rou fan", "braised pork rice", "minced pork rice"),
    d("Scallion pancake", "🥞", "scallion pancake", "green onion pancake"),
    d("Oyster omelet", "🍳", "oyster omelet", "oyster omelette"),
    d("Three cup chicken", "🍗", "three cup chicken"),
    d("Stinky tofu", "🧆", "stinky tofu"),
    d("Boba milk tea", "🧋", "boba", "bubble tea", "milk tea"),
    d("Shaved ice", "🍧", "shaved ice"),
  ],
  ice_cream: [
    d("Vanilla", "🍦", "vanilla"),
    d("Chocolate", "🍫", "chocolate"),
    d("Strawberry", "🍓", "strawberry"),
    d("Mint chip", "🍃", "mint chip", "mint chocolate"),
    d("Cookie dough", "🍪", "cookie dough"),
    d("Salted caramel", "🧂", "salted caramel"),
    d("Soft serve", "🍦", "soft serve"),
    d("Sundae", "🍨", "sundae"),
    d("Milkshake", "🥤", "milkshake", "milk shake"),
    d("Gelato", "🍨", "gelato"),
    d("Sorbet", "🍧", "sorbet"),
    d("Waffle cone", "🧇", "waffle cone"),
  ],
  dessert: [
    d("Latte", "☕", "latte"),
    d("Cappuccino", "☕", "cappuccino"),
    d("Cold brew", "🧊", "cold brew"),
    d("Matcha", "🍵", "matcha"),
    d("Boba", "🧋", "boba", "bubble tea"),
    d("Croissant", "🥐", "croissant"),
    d("Pastries", "🥐", "pastry", "pastries"),
    d("Donuts", "🍩", "donut", "doughnut"),
    d("Cinnamon roll", "🌀", "cinnamon roll"),
    d("Cheesecake", "🍰", "cheesecake"),
    d("Ice cream", "🍨", "ice cream"),
    d("Gelato", "🍨", "gelato"),
  ],
};

export interface ReviewText {
  rating: number | null;
  text: string;
}

export interface PopularDish {
  name: string;
  emoji: string;
  /** How many of the reviews read mention it (a review counts once). */
  mentions: number;
}

/** Only reviews rated this high count, so "popular" isn't a list of things people complained about. */
export const MIN_REVIEW_RATING = 4;
export const MAX_DISHES_SHOWN = 4;

/** Lower-case, strip accents ("phở" → "pho"), and collapse whitespace. */
function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase()
    .replace(/\s+/g, " ");
}

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Dishes from the cuisine's list that positive reviews mention, most-mentioned first (ties keep the list's order). */
export function extractDishes(reviews: ReviewText[], cuisine: CuisineKey | null): PopularDish[] {
  if (!cuisine) return [];
  const texts = reviews.filter((r) => (r.rating ?? 0) >= MIN_REVIEW_RATING && r.text.trim()).map((r) => normalize(r.text));
  if (texts.length === 0) return [];

  const found: (PopularDish & { order: number })[] = [];
  DISH_LISTS[cuisine].forEach((dish, order) => {
    const pattern = new RegExp(`(?<![a-z0-9])(?:${dish.aliases.map((a) => escapeRegExp(a)).join("|")})(?:s|es)?(?![a-z0-9])`);
    const mentions = texts.filter((t) => pattern.test(t)).length;
    if (mentions > 0) found.push({ name: dish.name, emoji: dish.emoji, mentions, order });
  });
  return found
    .sort((a, b) => b.mentions - a.mentions || a.order - b.order)
    .slice(0, MAX_DISHES_SHOWN)
    .map(({ name, emoji, mentions }) => ({ name, emoji, mentions }));
}
