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
    if (!loaded || !Turnstile || !props.sitekey) {
      if (loaded && !props.sitekey) {
        console.error('Turnstile loaded but sitekey is missing!');
      }
      return;
    }

    console.log('Turnstile ready, sitekey present: YES');
    
    // Wait for Turnstile to fully mount before executing
    const timer = setTimeout(() => {
      if (ref?.current) {
        try {
          console.log('Attempting to execute Turnstile manually');
          ref.current.execute();
        } catch (e) {
          console.error('Failed to execute Turnstile:', e);
        }
      } else {
        console.warn('Turnstile ref not available for manual execute');
      }
    }, 1500);
    
    return () => clearTimeout(timer);
  }, [loaded, Turnstile, props.sitekey]);

  if (error) {
    console.error('Turnstile component is not available:', error);
    return null;
  }

  if (!Turnstile) {
    // Still loading
    return null;
  }

  try {
    console.log('Rendering Turnstile component with sitekey:', props.sitekey ? 'PRESENT' : 'MISSING');
    return <Turnstile ref={ref} {...props} />;
  } catch (error) {
    console.error('Turnstile render error:', error);
    return null;
  }
});

TurnstileWrapper.displayName = 'TurnstileWrapper';

export default TurnstileWrapper;
