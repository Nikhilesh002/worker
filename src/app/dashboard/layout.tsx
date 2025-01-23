"use client";

import Header from "@/app/dashboard/_components/Header";
import Sidebar from "@/components/custom/Sidebar";
import {
  NavigationContext,
  NavigationContextProvider,
} from "@/lib/NavigationContextProvider";
import { Authenticated } from "convex/react";
import { use } from "react";

export default function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { isMobileNavOpen, closeMobileNav } = use(NavigationContext);

  return (
    <Authenticated>
      <NavigationContextProvider>
        <div className="flex h-screen">
          <Sidebar />
          <div className="flex-1 border-l-4 border-orange-500">
            <div className="">
              <Header />
              <main>{children}</main>
            </div>
          </div>
        </div>
      </NavigationContextProvider>
    </Authenticated>
  );
}
