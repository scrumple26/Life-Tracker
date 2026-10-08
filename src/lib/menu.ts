// Top-level menu: two dropdown groups. Each item can be switched off in
// Settings (stored as Settings.hiddenMenu), which hides it from the menu
// without touching its data.

export const MENU = [
  {
    id: "events",
    label: "Events",
    items: [
      { id: "concerts", label: "Concerts", emoji: "🎤" },
      { id: "movies", label: "Movies", emoji: "🎬" },
      { id: "sports", label: "Sports", emoji: "🏟️" },
      { id: "other-events", label: "Other", emoji: "🎟️" },
    ],
  },
  {
    id: "explore",
    label: "Explore",
    items: [
      { id: "courses", label: "Courses & Trails", emoji: "🥾" },
      { id: "landmarks", label: "Landmarks", emoji: "🏛️" },
      { id: "parks", label: "Parks", emoji: "🌳" },
      { id: "restaurants", label: "Restaurants", emoji: "🍽️" },
      { id: "vacation", label: "Vacation", emoji: "✈️" },
    ],
  },
] as const;

export type MenuGroup = (typeof MENU)[number];
export type MenuItemId = MenuGroup["items"][number]["id"];
export type ScreenId = MenuItemId | "settings";

export function visibleMenu(hidden: string[]) {
  const off = new Set(hidden);
  return MENU.map((g) => ({ ...g, items: g.items.filter((i) => !off.has(i.id)) })).filter(
    (g) => g.items.length > 0
  );
}
