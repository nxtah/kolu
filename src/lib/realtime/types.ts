// Provider-agnostic boundary for realtime transport — docs/ARCHITECTURE.md
// leaves the choice between WebSocket, SSE, or a managed realtime service
// open ("select... based on simplicity"). No transport is installed; this
// only defines the event shape the OBS overlay consumes, which must always
// be structured data, never arbitrary HTML/JS (docs/ARCHITECTURE.md,
// docs/SECURITY.md).

export interface DonationRealtimeEvent {
  type: "DONATION";
  donationId: string;
  displayName: string;
  amount: number;
  message?: string;
}

export interface MediaDonationRealtimeEvent {
  type: "MEDIA_DONATION";
  donationId: string;
  provider: string;
  contentId: string;
  title?: string;
  thumbnailUrl?: string;
  durationMs?: number;
  message?: string;
  displayName: string;
}

export type OverlayEvent = DonationRealtimeEvent | MediaDonationRealtimeEvent;

export interface RealtimePublisher {
  publish(streamerId: string, event: OverlayEvent): Promise<void>;
}
