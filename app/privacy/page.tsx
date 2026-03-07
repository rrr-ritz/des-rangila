import { EventHeader } from "@/components/shared/EventHeader";

export default function PrivacyPage() {
  return (
    <main className="min-h-screen p-8 max-w-2xl mx-auto">
      <EventHeader className="mb-8" />

      <h1 className="text-2xl font-bold mb-6">Privacy Policy</h1>

      <div className="prose prose-sm max-w-none space-y-4 text-muted-foreground">
        <section>
          <h2 className="text-lg font-semibold text-foreground">
            What We Collect
          </h2>
          <p>
            When you register for Des Rangila, we collect your name and email
            address (provided during passport purchase). At the event, we generate
            a unique PIN and QR code for your digital passport. Volunteers
            provide a phone number for authentication.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">
            Face Recognition
          </h2>
          <p>
            At check-in, we take a quick profile photo so event
            photographer photos can be automatically linked to your profile. We
            capture a selfie and extract a numeric face
            descriptor (a 128-number array). This descriptor cannot be used to
            reconstruct your face. The selfie is discarded after processing.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">
            How We Use Your Data
          </h2>
          <ul className="list-disc list-inside space-y-1">
            <li>To operate the digital passport system during the event</li>
            <li>To track which stations you visit and food you receive</li>
            <li>To link photo booth photos to your profile</li>
            <li>
              To match photographer photos to your profile (if you opted in)
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">
            Data Retention
          </h2>
          <p>
            All personal data, face descriptors, and photos are permanently
            deleted 30 days after the event (May 11, 2026). You may request
            earlier deletion by contacting us.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">
            Data Sharing
          </h2>
          <p>
            We do not share your personal information with any third parties.
            Data is stored securely on Google Firebase infrastructure.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">Contact</h2>
          <p>
            For questions or deletion requests, contact the UMD Indian Student
            Association.
          </p>
        </section>
      </div>
    </main>
  );
}
