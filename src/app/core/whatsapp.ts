/** Enlace para escribirle al negocio por WhatsApp con un mensaje ya escrito. */
export function whatsappChatUrl(phone: string, message: string): string {
  return `https://wa.me/${phone.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`;
}

/** Enlace para compartir un texto por WhatsApp eligiendo el contacto. */
export function whatsappShareUrl(message: string): string {
  return `https://wa.me/?text=${encodeURIComponent(message)}`;
}
