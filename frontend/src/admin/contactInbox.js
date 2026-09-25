/** Événement fenêtre : badge Messages contact dans AdminLayout. */
export const CONTACT_UNREAD_EVENT = 'isoko-contact-unread';

export function notifyContactUnread(count) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent(CONTACT_UNREAD_EVENT, {
      detail: typeof count === 'number' ? count : undefined,
    }),
  );
}
