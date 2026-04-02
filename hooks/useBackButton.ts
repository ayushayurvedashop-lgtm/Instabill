import { useEffect, useRef } from 'react';

/**
 * useBackButton — intercepts the browser/phone back button.
 *
 * When `isOpen` becomes true, pushes a history entry.
 * When the user presses back, calls `onClose` instead of navigating away.
 *
 * @param isOpen  Whether the modal/panel/page is currently open
 * @param onClose Callback to close the modal/panel or navigate back
 */
export function useBackButton(isOpen: boolean, onClose: () => void) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!isOpen) return;

    // Push a state entry so the back button fires popstate instead of leaving
    history.pushState({ backButton: true }, '');

    const handlePopState = () => {
      onCloseRef.current();
    };

    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [isOpen]);
}
