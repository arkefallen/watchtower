"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

interface NavItem {
  href: string;
  label: string;
  icon: string;
  badge?: string;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Dashboard", icon: "dashboard" },
  { href: "/wallets", label: "Wallets", icon: "account_balance_wallet" },
  { href: "/clusters", label: "Clusters", icon: "hub" },
  { href: "/graph", label: "Graph", icon: "account_tree" },
  { href: "/radar", label: "Radar", icon: "radar" },
  { href: "/alerts", label: "Alerts", icon: "notifications_active" },
  { href: "/self", label: "Self-tracking", icon: "location_searching" },
  { href: "/tokens", label: "Token lookup", icon: "search" },
  { href: "/settings", label: "Settings", icon: "settings" },
  { href: "/health", label: "Health", icon: "health_and_safety" },
];

export function Sidebar() {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const renderNavList = () => (
    <ul className="flex flex-col gap-1">
      {NAV_ITEMS.map((item) => {
        const isActive =
          item.href === "/"
            ? pathname === "/"
            : pathname.startsWith(item.href);

        return (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              onClick={() => setMobileMenuOpen(false)}
              className={`flex items-center justify-between px-4 py-2.5 text-[12px] font-semibold uppercase tracking-wider transition-colors duration-100 rounded-none ${
                isActive
                  ? "bg-[#1E2327] text-[#D7A84B] border-l-2 border-[#D7A84B]"
                  : "text-[#929BA3] hover:text-[#E8ECEF] hover:bg-[#171A1D]"
              }`}
            >
              <div className="flex items-center gap-3">
                <span
                  aria-hidden="true"
                  className="material-symbols-outlined text-[18px] shrink-0"
                  style={{ fontVariationSettings: isActive ? "'FILL' 1" : "'FILL' 0" }}
                >
                  {item.icon}
                </span>
                <span>{item.label}</span>
              </div>
              {item.badge && (
                <span className="px-1.5 py-0.5 text-[9px] font-mono border border-[#30373D] bg-[#101214] text-[#D7A84B] rounded-none">
                  {item.badge}
                </span>
              )}
            </Link>
          </li>
        );
      })}
    </ul>
  );

  return (
    <>
      {/* Mobile Top App Bar (visible only on screens < md) */}
      <div className="md:hidden sticky top-0 z-40 h-14 bg-[#121416] border-b border-[#30373D] flex items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="w-7 h-7 border border-[#30373D] bg-[#1E2327] flex items-center justify-center text-[#D7A84B] rounded-none">
            <span className="material-symbols-outlined text-[18px]">visibility</span>
          </div>
          <div>
            <div className="text-[12px] font-bold uppercase tracking-widest text-[#D7A84B] leading-none">
              WATCHTOWER
            </div>
            <div className="font-mono text-[8px] uppercase tracking-wider text-[#929BA3] mt-0.5">
              EVM INTEL CORE
            </div>
          </div>
        </Link>
        <button
          type="button"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label={mobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
          className="h-8 w-8 flex items-center justify-center border border-[#30373D] bg-[#171A1D] text-[#E8ECEF] hover:text-[#D7A84B] hover:border-[#D7A84B] transition-colors rounded-none"
        >
          <span className="material-symbols-outlined text-[20px]">
            {mobileMenuOpen ? "close" : "menu"}
          </span>
        </button>
      </div>

      {/* Mobile Drawer Backdrop and Overlay */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-xs transition-opacity"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="relative w-64 max-w-[80vw] bg-[#121416] border-r border-[#30373D] flex flex-col h-full z-10 shadow-2xl">
            {/* Drawer Header */}
            <div className="h-14 flex items-center justify-between px-4 border-b border-[#30373D]">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#D7A84B] text-[18px]">visibility</span>
                <span className="text-[12px] font-bold uppercase tracking-wider text-[#D7A84B]">
                  WATCHTOWER
                </span>
              </div>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="text-[#929BA3] hover:text-[#E8ECEF] p-1"
                aria-label="Close menu"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            {/* Nav list in mobile drawer */}
            <nav aria-label="Primary navigation" className="flex-1 overflow-y-auto py-3 px-2">
              {renderNavList()}
            </nav>

            {/* Mobile Footer Status */}
            <div className="p-3 border-t border-[#30373D] bg-[#101214] font-mono text-[10px] text-[#929BA3] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-none bg-[#79B79A]" />
                <span>CORE ONLINE</span>
              </div>
              <span>v0.1.0</span>
            </div>
          </div>
        </div>
      )}

      {/* Desktop Fixed Side Navigation (hidden on mobile, fixed w-60 on >= md) */}
      <aside
        aria-label="Main Navigation"
        className="hidden md:flex flex-col fixed top-0 bottom-0 left-0 w-60 bg-[#121416] border-r border-[#30373D] z-30 select-none"
      >
        {/* Brand Header */}
        <div className="h-16 flex items-center px-4 border-b border-[#30373D] justify-between">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 border border-[#30373D] bg-[#1E2327] flex items-center justify-center text-[#D7A84B] rounded-none group-hover:border-[#D7A84B] transition-colors">
              <span className="material-symbols-outlined text-[20px]">visibility</span>
            </div>
            <div>
              <div className="text-[13px] font-bold uppercase tracking-widest text-[#D7A84B] group-hover:brightness-110 transition-colors leading-none">
                WATCHTOWER
              </div>
              <div className="font-mono text-[9px] uppercase tracking-wider text-[#929BA3] mt-1">
                EVM INTEL CORE
              </div>
            </div>
          </Link>
        </div>

        {/* Navigation Items List */}
        <nav aria-label="Primary navigation" className="flex-1 py-4 px-2 overflow-y-auto">
          {renderNavList()}
        </nav>

        {/* System Operator & Status Footer */}
        <div className="p-3 border-t border-[#30373D] bg-[#101214] flex flex-col gap-2">
          <div className="flex items-center justify-between font-mono text-[10px] text-[#929BA3]">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-none bg-[#79B79A]" />
              <span className="text-[#E8ECEF]">CORE ONLINE</span>
            </div>
            <span className="text-[#D7A84B]">v0.1.0</span>
          </div>
        </div>
      </aside>
    </>
  );
}
