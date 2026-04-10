import { redirect } from "next/navigation";

// Templates are managed under Settings → Spec Categories
export default function TemplatesPage() {
  redirect("/settings/categories");
}
