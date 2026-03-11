export interface NavItem {
  href: string;
  label: string;
  mobileLabel?: string;
  icon: string;
  mobileIcon?: string;
}

export const navItems: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", mobileLabel: "Home", icon: "home", mobileIcon: "\u{1F3E0}" },
  { href: "/lesson", label: "Lesson", icon: "mic", mobileIcon: "\u{1F3A4}" },
];

export function isNavActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}
