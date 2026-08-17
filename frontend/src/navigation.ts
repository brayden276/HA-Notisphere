export const ROUTES = ["notifications", "people", "activity", "settings"] as const;

export type AppRoute = (typeof ROUTES)[number];

export interface NavigationItem {
  route: AppRoute;
  label: string;
  icon: string;
  adminOnly?: boolean;
}

export const NAVIGATION_ITEMS: readonly NavigationItem[] = [
  { route: "notifications", label: "Notifications", icon: "mdi:bell-outline" },
  { route: "people", label: "Household", icon: "mdi:account-multiple-outline" },
  { route: "activity", label: "Activity", icon: "mdi:history" },
  { route: "settings", label: "Settings", icon: "mdi:cog-outline", adminOnly: true },
];

export function routeFromHash(hash: string): AppRoute {
  const candidate = hash.replace(/^#\/?/, "").split(/[/?]/, 1)[0];
  return ROUTES.includes(candidate as AppRoute) ? (candidate as AppRoute) : "notifications";
}

export function routeForUser(route: AppRoute, isAdmin: boolean): AppRoute {
  return route === "settings" && !isAdmin ? "notifications" : route;
}

export function navigationForUser(isAdmin: boolean): readonly NavigationItem[] {
  return NAVIGATION_ITEMS.filter((item) => isAdmin || !item.adminOnly);
}

export function hrefForRoute(route: AppRoute): string {
  return `#/${route}`;
}
