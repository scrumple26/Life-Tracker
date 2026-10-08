// Top-level menu: two dropdown groups. Each item can be switched off in
// Settings (stored as Settings.hiddenMenu), which hides it from the menu
// without touching its data.

export const MENU = [
  {
    id: "events",
    label: "Events",
    items: [
      { id: "concerts", label: "Concerts" },
      { id: "movies", label: "Movies" },
      { id: "sports", label: "Sports" },
      { id: "other-events", label: "Other" },
    ],
  },
  {
    id: "explore",
    label: "Explore",
    items: [
      { id: "courses", label: "Courses & Trails" },
      { id: "landmarks", label: "Landmarks" },
      { id: "parks", label: "Parks" },
      { id: "restaurants", label: "Restaurants" },
      { id: "vacation", label: "Vacation" },
    ],
  },
] as const;

export type MenuGroup = (typeof MENU)[number];
export type MenuItemId = MenuGroup["items"][number]["id"];
export type ScreenId = MenuItemId | "wishlist" | "settings";

export function visibleMenu(hidden: string[]) {
  const off = new Set(hidden);
  return MENU.map((g) => ({ ...g, items: g.items.filter((i) => !off.has(i.id)) })).filter(
    (g) => g.items.length > 0
  );
}
