import React from 'react'
import CustomInput from './CustomInput';
import { functionalities } from '@/constants';

function InitialChatInterface() {
  return (
    <div className="flex justify-center items-center h-screen">
      <div className="pb-20 space-y-4">
        <h1 className="text-4xl font-mono font-extrabold">
          What can I help with?
        </h1>

        <CustomInput />
        <div className="flex space-x-2 text-xs">
          {functionalities.map((fun, i) => (
            <div key={i} className={`border-2 border-${fun.color}`}>
              <p className={`text-${fun.color}`}>{fun.name}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default InitialChatInterface;
