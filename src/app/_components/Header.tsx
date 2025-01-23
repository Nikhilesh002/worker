import { ModeToggle } from '@/components/ui/theme-toggler'
import { ChartArea } from 'lucide-react'
import Link from 'next/link'
import React from 'react'

function Header() {
  return (
    <div>
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4">
          <div className="flex h-16 items-center justify-between">
            <Link href="/" className="flex items-center space-x-2">
              <ChartArea className="h-6 w-6 md:h-8 md:w-8 text-primary" />
              <span className="text-lg md:text-xl font-bold">Worker</span>
            </Link>
            <div className="flex items-center gap-4">
              <ModeToggle />
              {/* <Button className="hidden md:flex" variant="outline" size="sm">
                Sign Up
              </Button> */}
            </div>
          </div>
        </div>
      </header>
    </div>
  )
}

export default Header