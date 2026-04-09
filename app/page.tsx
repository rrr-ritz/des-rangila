import { EventHeader } from "@/components/shared/EventHeader";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <EventHeader className="mb-8" />
      <div className="max-w-md text-center space-y-4">
        <p className="text-muted-foreground">
          Welcome to the Des Rangila Digital Passport System. This platform
          powers the event experience for attendees, volunteers, and organizers.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
          <a
            href="/admin/login"
            className="inline-flex items-center justify-center rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity"
          >
            Admin Dashboard
          </a>
          <a
            href="/me"
            className="inline-flex items-center justify-center rounded-lg border border-border bg-card px-6 py-2.5 text-sm font-medium hover:bg-secondary transition-colors"
          >
            Attendee Portal
          </a>
        </div>
      </div>
    </main>
  );
}
