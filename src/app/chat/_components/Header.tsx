import { UserButton } from "@clerk/nextjs";
import { Separator } from "@/components/ui/separator";
import React, { use } from "react";
import { Button } from "../../../components/ui/button";
import { Menu } from "lucide-react";
import { NavigationContext } from "@/components/NavigationContext/NavigationContextProvider";
import { ModeToggle } from "@/components/ui/theme-toggler";

function Header() {
  const { isMobileNavOpen, setIsMobileNavOpen } = use(NavigationContext);

  return (
    <div>
      {/* top */}
      <div className="mt-4 fixed w-full z-90">
        <div className="flex justify-between items-center pe-4 pb-4">
          <div className="flex items-center">
            {!isMobileNavOpen && (
              <Button
                variant="ghost"
                onClick={() => {
                  console.log(isMobileNavOpen);
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

      <Separator />

      {/* bottom */}
    </div>
  );
}

export default Header;
