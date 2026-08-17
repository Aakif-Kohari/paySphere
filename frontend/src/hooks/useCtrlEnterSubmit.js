import { useEffect } from 'react';

// Submits the given form when the user presses Ctrl+Enter (or Cmd+Enter on Mac).
// `formRef` can be a React ref object or a function returning the form element.
export function useCtrlEnterSubmit(formRef) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!(e.ctrlKey || e.metaKey) || e.key !== 'Enter') return;

      const form =
        typeof formRef === 'function' ? formRef() : formRef?.current;
      if (!form) return;

      e.preventDefault();
      form.requestSubmit();
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [formRef]);
}

export default useCtrlEnterSubmit;
