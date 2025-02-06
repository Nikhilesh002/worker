"use client";

import Header from "@/app/chat/_components/Header";
import Sidebar from "@/components/custom/Sidebar";
import {
  NavigationContext,
  NavigationContextProvider,
} from "@/components/NavigationContext/NavigationContextProvider";
import { Authenticated } from "convex/react";
import { use } from "react";

export default function ChatLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { isMobileNavOpen } = use(NavigationContext);

  return (
    <Authenticated>
      <NavigationContextProvider>
        {!isMobileNavOpen && <Header />}
        <div className="flex h-screen">
          {isMobileNavOpen && <Sidebar />}

          <div className="flex-1 flex flex-col">
            {isMobileNavOpen && <Header />}
            <main className="flex-1 overflow-y-auto">{children}</main>
          </div>
        </div>
      </NavigationContextProvider>
    </Authenticated>
  );
}
