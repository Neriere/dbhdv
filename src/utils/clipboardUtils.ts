/**
 * Utility to copy an item name to clipboard and trigger a discreet toast notification.
 */
export async function copyItemNameToClipboard(name: string): Promise<boolean> {
  if (!name) return false;
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(name);
    } else if (typeof document !== 'undefined') {
      const textarea = document.createElement('textarea');
      textarea.value = name;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('dofus_toast', {
          detail: {
            message: `"${name}" copiado al portapapeles`,
            subtext: 'Pega con Ctrl + V en el mercadillo de Dofus',
          },
        })
      );
    }
    return true;
  } catch (err) {
    console.warn('No se pudo copiar al portapapeles:', err);
    return false;
  }
}
