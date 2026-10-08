"use client";

import { useApp } from "@/lib/data";
import { MENU, type MenuItemId } from "@/lib/menu";

export function SettingsTab() {
  const { data, saveField } = useApp();
  const hidden = new Set(data.settings.hiddenMenu);

  async function toggle(id: MenuItemId | "wishlist") {
    const next = new Set(hidden);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    await saveField("settings", { ...data.settings, hiddenMenu: [...next] });
  }

  return (
    <section className="lf-rise">
      <h2 className="text-4xl sm:text-5xl text-ink mb-2">Settings</h2>
      <p className="text-ink-soft mb-6 text-[15px]">
        Choose what shows up in the menu and how things are listed. Hiding something only removes it from the
        menu — anything you&apos;ve logged there stays saved.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        {MENU.map((group) => (
          <div key={group.id} className="card p-5">
            <p className="overline mb-3">{group.label}</p>
            <ul className="grid gap-1">
              {group.items.map((item) => {
                const on = !hidden.has(item.id);
                return (
                  <li key={item.id}>
                    <label className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-paper-2 cursor-pointer">
                      <span className="flex-1 text-sm font-medium text-ink">{item.label}</span>
                      <Switch on={on} onChange={() => toggle(item.id)} label={item.label} />
                    </label>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}

        <div className="card p-5">
          <p className="overline mb-3">Wishlist</p>
          <label className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-paper-2 cursor-pointer">
            <span className="flex-1 text-sm font-medium text-ink">Wishlist</span>
            <Switch on={!hidden.has("wishlist")} onChange={() => toggle("wishlist")} label="Wishlist" />
          </label>
        </div>

        <div className="card p-5">
          <p className="overline mb-3">Landmarks</p>
          <label className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-paper-2 cursor-pointer">
            <span className="flex-1">
              <span className="block text-sm font-medium text-ink">Count stadiums as landmarks</span>
              <span className="block text-xs text-muted">
                Venues from your logged games also appear under Landmarks.
              </span>
            </span>
            <Switch
              on={data.settings.stadiumsAsLandmarks}
              label="stadiums as landmarks"
              onChange={() =>
                saveField("settings", {
                  ...data.settings,
                  stadiumsAsLandmarks: !data.settings.stadiumsAsLandmarks,
                })
              }
            />
          </label>
        </div>
      </div>
    </section>
  );
}

function Switch({ on, onChange, label }: { on: boolean; onChange: () => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={`Show ${label}`}
      onClick={onChange}
      className={`relative h-6 w-11 shrink-0 rounded-full transition ${
        on ? "bg-terracotta" : "bg-line-strong"
      }`}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
          on ? "left-[22px]" : "left-0.5"
        }`}
      />
    </button>
  );
}
