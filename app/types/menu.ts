export interface Dish {
  name: string;
  original_language_name: string | null;
  english_name: string;
  short_description: string;
  key_ingredients: string[];
  price: string | null;
}
