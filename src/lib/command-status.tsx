"use client";

import { CircleCheck, Clock, Inbox, Loader2, XCircle } from "lucide-react";

const ICON_CLASS = "h-4 w-4 shrink-0";

export function formatCommandStatus(status: string): string {
  switch (status) {
    case "pending":
      return "Pending";
    case "delivered":
      return "Delivered";
    case "in_progress":
      return "Running";
    case "completed":
      return "Completed";
    case "failed":
      return "Failed";
    default:
      return status;
  }
}

export function commandStatusHint(status: string): string | null {
  switch (status) {
    case "pending":
      return "Waiting for the site to pick up this command.";
    case "delivered":
      return "The site received this command.";
    case "in_progress":
      return "The site is executing this command.";
    default:
      return null;
  }
}

export function CommandStatusIcon({ status }: { status: string }) {
  switch (status) {
    case "pending":
      return <Clock className={`${ICON_CLASS} text-yellow-500`} />;
    case "delivered":
      return <Inbox className={`${ICON_CLASS} text-sky-600`} />;
    case "in_progress":
      return <Loader2 className={`${ICON_CLASS} animate-spin text-blue-500`} />;
    case "completed":
      return <CircleCheck className={`${ICON_CLASS} text-green-500`} />;
    case "failed":
      return <XCircle className={`${ICON_CLASS} text-red-500`} />;
    default:
      return null;
  }
}
