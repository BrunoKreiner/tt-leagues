import { forwardRef, useState, useEffect } from 'react';

const TurnstileWrapper = forwardRef((props, ref) => {
  const [Turnstile, setTurnstile] = useState(null);
  const [error, setError] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Dynamically import Turnstile to handle bundling issues
    import('react-turnstile')
      .then((module) => {
        console.log('Turnstile module loaded successfully, module keys:', Object.keys(module));
        // react-turnstile uses default export, not named export
        const TurnstileComponent = module.default || module.Turnstile;
        console.log('Turnstile component:', TurnstileComponent ? 'PRESENT' : 'MISSING', 'type:', typeof TurnstileComponent);
        if (TurnstileComponent) {
          setTurnstile(TurnstileComponent);
          setLoaded(true);
          console.log('Turnstile state set successfully');
        } else {
          console.error('Turnstile component not found in module:', module);
          setError(new Error('Turnstile component not found'));
        }
      })
      .catch((err) => {
        console.error('Failed to load Turnstile:', err);
        setError(err);
      });
  }, []);

  // Auto-execute Turnstile once loaded (invisible mode)
  useEffect(() => {
    console.log('TurnstileWrapper useEffect - loaded:', loaded, 'Turnstile:', typeof Turnstile, 'sitekey:', !!props.sitekey);
    
    if (!loaded || !Turnstile || !props.sitekey) {
      if (loaded && !Turnstile) {
        console.error('Turnstile loaded flag is true but Turnstile component is not set!');
      }
      if (loaded && !props.sitekey) {
        console.error('Turnstile loaded but sitekey is missing!');
      }
      return;
    }

    console.log('Turnstile ready, sitekey present: YES');
    
    // Wait for Turnstile to fully mount before executing
    const timer1 = setTimeout(() => {
      console.log('Checking Turnstile ref:', ref?.current ? 'AVAILABLE' : 'NOT AVAILABLE');
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
    }, 2000);
    
    // Try again after longer delay
    const timer2 = setTimeout(() => {
      if (ref?.current) {
        try {
          console.log('Second attempt to execute Turnstile');
          ref.current.execute();
        } catch (e) {
          console.error('Second attempt failed:', e);
        }
      }
    }, 4000);
    
    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, [loaded, Turnstile, props.sitekey, ref]);

  if (error) {
    console.error('Turnstile component is not available:', error);
    return null;
  }

  if (!Turnstile) {
    // Still loading
    console.log('TurnstileWrapper: Still loading, Turnstile component not available yet');
    return null;
  }
  
  console.log('TurnstileWrapper: About to render Turnstile, props:', { 
    hasSitekey: !!props.sitekey, 
    hasOnSuccess: !!props.onSuccess,
    hasOnError: !!props.onError,
    hasOnLoad: !!props.onLoad,
    hasRef: !!ref
  });

  // Wait a bit to ensure DOM is ready before rendering
  useEffect(() => {
    if (loaded && Turnstile && props.sitekey) {
      const timer = setTimeout(() => {
        console.log('Setting mounted to true');
        setMounted(true);
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [loaded, Turnstile, props.sitekey]);

  // Ensure all required props are present before rendering
  if (!props.sitekey) {
    console.error('Cannot render Turnstile: sitekey is missing');
    return null;
  }

  if (!mounted) {
    console.log('TurnstileWrapper: Not mounted yet, waiting...');
    return null;
  }

  try {
    console.log('Rendering Turnstile component with sitekey:', props.sitekey ? 'PRESENT' : 'MISSING', 'ref:', ref ? 'PRESENT' : 'MISSING');
    // Create a clean props object without undefined values
    const cleanProps = {
      sitekey: props.sitekey,
      onSuccess: props.onSuccess || (() => {}),
      onError: props.onError || (() => {}),
      onExpire: props.onExpire || (() => {}),
      ...(props.onLoad && { onLoad: props.onLoad }),
      ...(props.options && { options: props.options })
    };
    const turnstileElement = <Turnstile ref={ref} {...cleanProps} />;
    console.log('Turnstile element created');
    return turnstileElement;
  } catch (error) {
    console.error('Turnstile render error:', error);
    return null;
  }
});

TurnstileWrapper.displayName = 'TurnstileWrapper';

export default TurnstileWrapper;
