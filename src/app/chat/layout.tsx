"use client";

import Header from "@/app/chat/_components/Header";
import Sidebar from "@/components/custom/Sidebar";
import { NavigationContextProvider } from "@/components/NavigationContext/NavigationContextProvider";
import { Authenticated } from "convex/react";

export default function ChatLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <Authenticated>
      <NavigationContextProvider>
        <div className="flex h-screen">
          <Sidebar />
          <div className="flex-1 border-l-[3px] border-rose-500">
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
