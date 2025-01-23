import { Textarea } from "@/components/ui/textarea";
import { ArrowUp } from "lucide-react";
import React, { useState } from "react";

function CustomInput() {
  const [inputValue, setInputValue] = useState("");

  const handleSubmit = () => {
    console.log(inputValue);
  };

  return (
    <div>
      <div className="border-x-[3px] border-b-[5px] border-t-[1px] border-gray-300 rounded-lg px-[10px]">
        <Textarea
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="Type here"
          rows={3}
          className="font-serif border border-gray-600"
        />
        <div className="flex justify-between items-center py-2">
          <p className="text-xs text-gray-400">Powered by LLM</p>
          <button
            onClick={handleSubmit}
            className="bg-white text-black rounded-full"
          >
            <ArrowUp />
          </button>
        </div>
      </div>
    </div>
  );
}

export default CustomInput;
