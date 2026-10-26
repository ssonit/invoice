import { redirect } from "next/navigation";

// Subscriptions are managed on the Vendors page; this keeps the natural URL working.
export default function SubscriptionsPage() {
  redirect("/dashboard/vendors");
}
