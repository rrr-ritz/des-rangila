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
            className="inline-flex items-center justify-center rounded-md bg-primary px-6 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Admin Dashboard
          </a>
          <a
            href="/me"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-6 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors"
          >
            Attendee Portal
          </a>
        </div>
      </div>
    </main>
  );
}
