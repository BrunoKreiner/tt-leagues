import { forwardRef, useState, useEffect, useImperativeHandle, useRef } from 'react';

const TurnstileWrapper = forwardRef((props, ref) => {
  const [Turnstile, setTurnstile] = useState(null);
  const [error, setError] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const internalRef = useRef(null);

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

  // Expose Turnstile methods via ref
  useImperativeHandle(ref, () => ({
    execute: () => {
      if (internalRef.current) {
        return internalRef.current.execute();
      }
    },
    reset: () => {
      if (internalRef.current) {
        return internalRef.current.reset();
      }
    },
    getResponse: () => {
      if (internalRef.current) {
        return internalRef.current.getResponse();
      }
    }
  }), []);

  if (error) {
    console.error('Turnstile component is not available:', error);
    return null;
  }

  if (!Turnstile || !loaded) {
    // Still loading
    console.log('TurnstileWrapper: Still loading, Turnstile component not available yet');
    return null;
  }

  // Ensure all required props are present before rendering
  if (!props.sitekey) {
    console.error('Cannot render Turnstile: sitekey is missing');
    return null;
  }

  try {
    console.log('Rendering Turnstile component with sitekey:', props.sitekey ? 'PRESENT' : 'MISSING');
    // Create a clean props object - react-turnstile uses direct props, not options object
    const cleanProps = {
      sitekey: props.sitekey,
      ...(props.onSuccess && { onSuccess: props.onSuccess }),
      ...(props.onError && { onError: props.onError }),
      ...(props.onExpire && { onExpire: props.onExpire }),
      ...(props.onLoad && { onLoad: props.onLoad }),
      // Support both direct props and options object for backward compatibility
      ...(props.size && { size: props.size }),
      ...(props.theme && { theme: props.theme }),
      ...(props.options?.size && { size: props.options.size }),
      ...(props.options?.theme && { theme: props.options.theme })
    };
    console.log('Clean props:', Object.keys(cleanProps));
    // Use internal ref and forward it properly
    const turnstileElement = <Turnstile ref={internalRef} {...cleanProps} />;
    console.log('Turnstile element created successfully');
    return turnstileElement;
  } catch (error) {
    console.error('Turnstile render error:', error);
    return null;
  }
});

TurnstileWrapper.displayName = 'TurnstileWrapper';

export default TurnstileWrapper;
