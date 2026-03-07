import { Card, CardContent } from "@/components/ui/card";

export default function AdminLoading() {
  return (
    <div className="space-y-6">
      {/* Header skeleton */}
      <div className="space-y-2">
        <div className="h-8 w-48 bg-muted animate-pulse rounded" />
        <div className="h-4 w-64 bg-muted animate-pulse rounded" />
      </div>

      {/* KPI cards skeleton */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-4 space-y-3">
              <div className="h-4 w-20 bg-muted animate-pulse rounded" />
              <div className="h-8 w-24 bg-muted animate-pulse rounded" />
              <div className="h-3 w-16 bg-muted animate-pulse rounded" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Content skeleton */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card>
            <CardContent className="p-6">
              <div className="h-5 w-28 bg-muted animate-pulse rounded mb-4" />
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="h-24 bg-muted animate-pulse rounded" />
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
        <Card>
          <CardContent className="p-6 space-y-3">
            <div className="h-5 w-24 bg-muted animate-pulse rounded" />
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-10 bg-muted animate-pulse rounded" />
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
