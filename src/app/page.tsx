"use client";

import { SignInButton, SignUpButton, SignedIn, SignedOut, UserButton } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <h1 className="text-xl font-bold">Tasks Manager</h1>
          <div className="flex items-center gap-4">
            <SignedIn>
              <UserButton afterSignOutUrl="/" />
            </SignedIn>
            <SignedOut>
              <div className="flex gap-2">
                <SignInButton mode="modal">
                  <Button variant="outline">Sign in</Button>
                </SignInButton>
                <SignUpButton mode="modal">
                  <Button>Sign up</Button>
                </SignUpButton>
              </div>
            </SignedOut>
          </div>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-4 py-12">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-4xl font-bold tracking-tight mb-4">
            Manage Your Tasks Efficiently
          </h2>
          <p className="text-lg text-muted-foreground mb-8">
            A modern task management application built with Next.js, Convex, and Clerk
          </p>
          
          <SignedOut>
            <div className="flex gap-4 justify-center">
              <SignUpButton mode="modal">
                <Button size="lg">Get Started</Button>
              </SignUpButton>
              <SignInButton mode="modal">
                <Button size="lg" variant="outline">Sign In</Button>
              </SignInButton>
            </div>
          </SignedOut>
          
          <SignedIn>
            <div className="mt-8 p-6 border rounded-lg bg-card">
              <h3 className="text-xl font-semibold mb-4">Welcome to Tasks Manager</h3>
              <p className="text-muted-foreground">
                Start creating and managing your tasks. Your dashboard is ready for you!
              </p>
            </div>
          </SignedIn>
        </div>
      </main>

      <footer className="border-t py-6">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          {new Date().getFullYear()} Tasks Manager. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
