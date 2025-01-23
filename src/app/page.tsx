import { Button } from "@/components/ui/button";
import { SignedIn, SignedOut, SignInButton } from "@clerk/nextjs";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import React from "react";
import Header from "./_components/Header";

function Page() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <Header/>

      {/* Main Content */}
      <div>
        <div className="flex flex-col items-center justify-center min-h-[calc(100vh-4rem)] px-4">
          <div className="max-w-3xl space-y-6 text-center">
            <h1 className="text-4xl md:text-6xl font-extrabold font-mono tracking-tighter">
              Welcome to your AI <span className="text-orange-500">Worker</span>
            </h1>
            <p className="text-base md:text-lg text-muted-foreground max-w-[42rem] mx-auto">
              Meet an AI chat companion that goes beyond the conversation
            </p>
            <div className="flex flex-col sm:flex-row justify-center items-center gap-4">
              <SignedIn>
                <Link href="/chat">
                  <Button size="lg" className="w-full sm:w-auto">
                    Chat now
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </SignedIn>

              <SignedOut>
                <SignInButton
                  mode="modal"
                  fallbackRedirectUrl={"/chat"}
                  forceRedirectUrl={"/chat"}
                >
                  <Button size="lg" className="w-full sm:w-auto">
                    Sign In
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </SignInButton>
              </SignedOut>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Page;
