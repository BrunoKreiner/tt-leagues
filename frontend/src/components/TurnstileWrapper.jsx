import { forwardRef } from 'react';
import { Turnstile } from 'react-turnstile';

const TurnstileWrapper = forwardRef((props, ref) => {
  if (!Turnstile) {
    console.error('Turnstile component is not available');
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
