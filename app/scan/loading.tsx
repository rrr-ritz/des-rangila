export default function ScanLoading() {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="space-y-4 text-center">
        <div className="h-12 w-12 mx-auto rounded-full border-4 border-primary border-t-transparent animate-spin" />
        <p className="text-sm text-muted-foreground">Loading scanner...</p>
      </div>
    </div>
  );
}
