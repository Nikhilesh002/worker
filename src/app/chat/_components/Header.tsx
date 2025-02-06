import { UserButton } from "@clerk/nextjs";
import React, { use } from "react";
import { Button } from "../../../components/ui/button";
import { Menu } from "lucide-react";
import { NavigationContext } from "@/components/NavigationContext/NavigationContextProvider";
import { ModeToggle } from "@/components/ui/theme-toggler";

function Header() {
  const { isMobileNavOpen, setIsMobileNavOpen } = use(NavigationContext);

  return (
    <div className="pt-4 w-full z-50 bg-black">
      <div className="flex justify-between items-center pe-4 pb-4">
        <div className="flex items-center">
          {!isMobileNavOpen && (
            <Button
              variant="ghost"
              onClick={() => {
                setIsMobileNavOpen(!isMobileNavOpen);
              }}
            >
              <Menu />
            </Button>
          )}
          <h1 className="text-2xl ms-2 font-bold text-white">
            Chat with <span className="text-orange-500">Worker</span>
          </h1>
        </div>

        <div className="flex items-center space-x-4">
          <ModeToggle />
          <UserButton />
        </div>
      </div>
    </div>
  );
}

export default Header;
