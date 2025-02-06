import React from "react";

const formatMessage = (content: string) => {
  // first unescape backslashes
  content = content.replace(/\\\\/g, "\\");

  // new lines
  content = content.replace(/\\n/g, "\n");

  // remove markers
  content = content.replace("---START---", "").replace("---END---", "");

  return content.trim();
};

function MessageBubble({
  content,
  isUser,
}: {
  content: string;
  isUser: boolean;
}) {
  return (
    <div className={`mb-4 flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`rounded-2xl px-4 py-2 shadow-sm ring-1 ring-inset relative ${
          isUser
            ? "bg-[#323232d9]  w-[80%] md:w-[70%] text-white rounded-br-none ring-gray-700"
            : "bg-gray-800 w-full text-white rounded-bl-none ring-gray-600"
        }`}
      >
        <div className="whitespace-pre-wrap text-wrap text-sm leading-relaxed">
          <div
            dangerouslySetInnerHTML={{ __html: formatMessage(content) }}
          ></div>
        </div>
      </div>
    </div>
  );
}

export default MessageBubble;
