"use server";

// Branché sur Twilio à l'étape « Relances SMS ».
export async function remindBySms(formData: FormData) {
  const invoiceId = formData.get("invoiceId");
  if (typeof invoiceId !== "string") return;
}
