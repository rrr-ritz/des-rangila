import { Timestamp } from "firebase/firestore";

// === Type Aliases ===

export type StationType =
  | "activity"
  | "food"
  | "both"
  | "none"
  | "registration"
  | "photo-booth";
export type WalletPassType = "apple" | "google" | "web";
export type PhotoType = "booth" | "photographer" | "event";
export type Role = "volunteer" | "admin";
export type AuditSeverity = "info" | "warning" | "error";

export type AuditAction =
  | "redemption.created"
  | "volunteer.station_changed"
  | "attendee.checked_in"
  | "inventory.low_stock"
  | "inventory.depleted"
  | "photo.uploaded"
  | "admin.import_attendees"
  | "walkin.created"
  | "system.error";

// === Collection: attendees ===

export interface Attendee {
  id: string;
  pin: string;
  qrPayload: string;
  name: string;
  email: string;
  checkedIn: boolean;
  checkedInAt: Timestamp | null;
  faceDescriptor: number[] | null;
  faceConsentGiven: boolean;
  stampsCollected: string[];
  totalFoodRedemptions: number;
  maxFoodRedemptions: number;
  walletPassGenerated: boolean;
  walletPassType: WalletPassType | null;
  phone?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// === Collection: stations ===

export interface Station {
  id: string;
  name: string;
  region: string;
  type: StationType;
  activityName: string | null;
  foodItem: string | null;
  tableNumber: number;
  order: number;
  isActive: boolean;
}

// === Collection: inventory ===

export interface InventoryItem {
  id: string;
  stationId: string;
  itemName: string;
  itemType: "food" | "activity-supply";
  initialCount: number;
  remainingCount: number;
  unit: string;
  lowStockThreshold: number;
  depletedAt: Timestamp | null;
}

// === Collection: redemptions ===

export interface Redemption {
  id: string;
  attendeeId: string;
  attendeeName: string;
  stationId: string;
  stationName: string;
  itemType: string;
  volunteerId: string;
  volunteerName: string;
  timestamp: Timestamp;
  syncedFromOffline: boolean;
  idempotencyKey: string;
}

// === Collection: volunteers ===

export interface Volunteer {
  id: string;
  uid: string;
  name: string;
  phone: string;
  role: Role;
  currentStationId: string | null;
  isActive: boolean;
  createdAt: Timestamp;
}

// === Collection: photos ===

export interface Photo {
  id: string;
  attendeeIds: string[];
  stationId: string | null;
  photoType: PhotoType;
  storageUrl: string;
  thumbnailUrl: string;
  stripUrl: string | null;
  width: number;
  height: number;
  takenAt: Timestamp;
  uploadedAt: Timestamp;
  faceMatchConfidence: number | null;
  approved: boolean;
}

// === Collection: audit_log ===

export interface AuditLogEntry {
  id: string;
  action: AuditAction | string;
  actorId: string;
  actorName: string;
  actorRole: Role | "system";
  targetId: string | null;
  targetType: string | null;
  details: Record<string, unknown>;
  severity: AuditSeverity;
  timestamp: Timestamp;
  notifyAdmins: boolean;
}
