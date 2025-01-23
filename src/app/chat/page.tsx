import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ArrowBigUp, ArrowUp } from "lucide-react";
import React from "react";

function page() {
  return (
    <div className="flex justify-center items-center h-screen">
      <div className="pb-32 space-y-4">
        <h1 className="text-4xl font-mono font-extrabold">
          What can I help with?
        </h1>
        <div className="border-x-[3px] border-b-[5px] border-t-[1px] border-gray-300 rounded-lg px-4">
          <Textarea rows={3} className="border border-gray-600" />
          <div className="flex justify-between items-center py-2">
            <p className="text-xs text-gray-400">Powered by Gemini</p>
            <button className="bg-white text-black rounded-full">
              <ArrowUp />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default page;
