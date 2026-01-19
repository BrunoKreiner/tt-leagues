import { forwardRef, useState, useEffect } from 'react';

const TurnstileWrapper = forwardRef((props, ref) => {
  const [Turnstile, setTurnstile] = useState(null);
  const [error, setError] = useState(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    // Dynamically import Turnstile to handle bundling issues
    import('react-turnstile')
      .then((module) => {
        console.log('Turnstile module loaded successfully');
        setTurnstile(() => module.Turnstile);
        setLoaded(true);
      })
      .catch((err) => {
        console.error('Failed to load Turnstile:', err);
        setError(err);
      });
  }, []);

  // Auto-execute Turnstile once loaded (invisible mode)
  useEffect(() => {
    if (loaded && ref?.current && Turnstile) {
      const timer = setTimeout(() => {
        if (ref.current) {
          try {
            console.log('Attempting to execute Turnstile');
            ref.current.execute();
          } catch (e) {
            console.error('Failed to execute Turnstile:', e);
          }
        }
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [loaded, ref, Turnstile]);

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
