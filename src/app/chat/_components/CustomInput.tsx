"use client";

import { Textarea } from "@/components/ui/textarea";
import { ArrowUp } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";

function CustomInput() {
  const [inputValue, setInputValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [streamedResponse, setStreamedResponse] = useState<string>("");
  const [currentTool, setCurrentTool] = useState<{
    name: string;
    input: unknown;
  } | null>(null);


  const handleSubmit = async () => {
    console.log(inputValue);

    const trimmedInput = inputValue.trim();

    if (trimmedInput === "" || loading) return;

    setInputValue("");
    setStreamedResponse("");
    setCurrentTool(null);
    setLoading(true);
  };

  const keyDownHandler = (e: any) => {
    if (e.key === "Enter" && e.ctrlKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="w-full">
      <div className="w-full border-l-2 border-r-[5px] border-b-[5px] border-t-[2px] border-orange-300 rounded-lg px-[10px]">
        <Textarea
          onKeyDown={keyDownHandler}
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value);
            console.log(e.target.value);
          }}
          placeholder="Type here"
          rows={3}
          className="font-serif border border-gray-600"
        />
        <div className="flex justify-between items-center py-2">
          <p className="text-xs text-gray-400">Powered by LLM</p>
          <button
            onClick={handleSubmit}
            disabled={!inputValue.trim()}
            className={`rounded-full ${
              inputValue.trim()
                ? "bg-white text-black"
                : "bg-gray-500 text-gray-200"
            }`}
          >
            <ArrowUp />
          </button>
        </div>
      </div>
    </div>
  );
}

export default CustomInput;
