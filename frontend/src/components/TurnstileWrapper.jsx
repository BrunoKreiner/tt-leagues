import { forwardRef, useState, useEffect } from 'react';

const TurnstileWrapper = forwardRef((props, ref) => {
  const [Turnstile, setTurnstile] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Dynamically import Turnstile to handle bundling issues
    import('react-turnstile')
      .then((module) => {
        setTurnstile(() => module.Turnstile);
      })
      .catch((err) => {
        console.error('Failed to load Turnstile:', err);
        setError(err);
      });
  }, []);

  if (error) {
    console.error('Turnstile component is not available:', error);
    return null;
  }

  if (!Turnstile) {
    // Still loading
    return null;
  }

  try {
    return <Turnstile ref={ref} {...props} />;
  } catch (error) {
    console.error('Turnstile render error:', error);
    return null;
  }
});

TurnstileWrapper.displayName = 'TurnstileWrapper';

export default TurnstileWrapper;
