export type SessionKind = "google" | "discord" | "local";

export type SessionPayload = {
  kind: SessionKind;
  userId: number;
};