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
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(true);

  return (
    <NavigationContext.Provider
      value={{
        isMobileNavOpen,
        setIsMobileNavOpen,
        closeMobileNav: () => {
          setIsMobileNavOpen(false);
        },
      }}
    >
      {children}
    </NavigationContext.Provider>
  );
}
