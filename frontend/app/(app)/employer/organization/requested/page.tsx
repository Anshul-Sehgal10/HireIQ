"use client";

import Link from "next/link";
import { Clock3 } from "lucide-react";
import { Card, CardContent, Button } from "@/components/ui";

export default function RequestedPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 text-foreground">
      <div className="w-full max-w-md text-center">
        <Card className="p-8">
          <CardContent className="p-0">
            <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
              <Clock3 size={22} />
            </div>
            <h1 className="mb-3 text-2xl font-bold text-foreground">Request sent</h1>
            <p className="mb-8 text-sm leading-relaxed text-muted-foreground">
              Your join request has been sent to the organisation's admin. You'll be able to post
              jobs as soon as they approve you.
            </p>
            <div className="flex flex-col gap-3">
              <Link href="/employer/dashboard">
                <Button variant="secondary" className="w-full">
                  Back to dashboard
                </Button>
              </Link>
              <Link
                href="/employer/organization/setup"
                className="py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                Try a different organisation
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}