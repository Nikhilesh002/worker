import { SignUp } from "@clerk/nextjs"

export default function SignUpPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 p-6">
      <SignUp forceRedirectUrl="/chat" fallbackRedirectUrl="/chat" />
    </div>
  )
}
