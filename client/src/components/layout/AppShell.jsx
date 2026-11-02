import React from "react";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import MobileNav from "./MobileNav";
import OfflineBanner from "../common/OfflineBanner";

export default function AppShell({ children }) {
  return (
    <div className="min-h-screen bg-background">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[80] focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:text-text-primary"
      >
        Skip to main content
      </a>
      <Sidebar />
      <div className="lg:ml-64 flex flex-col min-h-screen">
        <OfflineBanner />
        <Topbar />
        <main
          id="main-content"
          tabIndex={-1}
          className="flex-1 px-4 sm:px-6 lg:px-8 py-6 pb-24 lg:pb-8 max-w-container mx-auto w-full outline-none"
        >
          {children}
        </main>
      </div>
      <MobileNav />
    </div>
  );
}
