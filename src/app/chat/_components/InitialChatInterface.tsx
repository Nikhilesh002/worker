import React from "react";
import CustomInput from "./CustomInput";
import { functionalities } from "../../../../constants/constants";
import { Id } from "../../../../convex/_generated/dataModel";

function InitialChatInterface() {
  return (
    <div className="w-1/2 text-center flex justify-center items-center h-screen">
      <div className="w-full pb-20 space-y-4">
        <h1 className="text-4xl font-mono font-extrabold">
          What can I help with?
        </h1>

        <CustomInput
          messages={[]}
          setMessages={() => {}}
          chatId={"" as Id<"chats">}
        />

        <div className="flex space-x-5 text-[12px] justify-center">
          {functionalities.map((fun, i) => (
            <div key={i} className={`border border-${fun.color} rounded`}>
              <p className={`text-${fun.color} px-1 py-0.5`}>{fun.name}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default InitialChatInterface;
