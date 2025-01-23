import React from 'react'

function page({params}:any) {

  return (
    <div className='text-white'>{JSON.stringify(params)}</div>
  )
}

export default page;
