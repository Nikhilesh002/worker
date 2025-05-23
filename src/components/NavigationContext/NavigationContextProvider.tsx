"use client";

import { createContext, useState } from "react";

interface NavigationContextType {
  isMobileNavOpen: boolean;
  setIsMobileNavOpen: (isOpen: boolean) => void;
  closeMobileNav: () => void;
}

export const NavigationContext = createContext<NavigationContextType>({
  isMobileNavOpen: true,
  setIsMobileNavOpen: () => {},
  closeMobileNav: () => {},
});

export function NavigationContextProvider({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(() => {
    return localStorage.getItem("isMobileNavOpen") === "true";
  });

  const setNavBarStatusLocalStorage = (isOpen: boolean) => {
    localStorage.setItem("isMobileNavOpen", isOpen.toString());
    setIsMobileNavOpen(isOpen);
  };

  return (
    <NavigationContext.Provider
      value={{
        isMobileNavOpen,
        setIsMobileNavOpen: setNavBarStatusLocalStorage,
        closeMobileNav: () => {
          setIsMobileNavOpen(false);
          localStorage.setItem("isMobileNavOpen", "false");
        },
      }}
    >
      {children}
    </NavigationContext.Provider>
  );
}
