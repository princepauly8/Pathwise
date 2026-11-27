export interface RazorpaySuccessResponse {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

export interface RazorpayFailureResponse {
  error?: {
    code?: string;
    description?: string;
    source?: string;
    step?: string;
    reason?: string;
  };
}

export interface RazorpayCheckoutConfig {
  key: string;
  amount: number;
  currency: 'INR';
  name: string;
  description: string;
  order_id: string;
  prefill?: {
    name?: string;
    email?: string;
  };
  notes?: Record<string, string>;
  theme?: {
    color?: string;
  };
}

interface RazorpayInstance {
  open: () => void;
  on: (event: 'payment.failed', callback: (response: RazorpayFailureResponse) => void) => void;
}

interface RazorpayConstructor {
  new (options: RazorpayCheckoutConfig & {
    handler: (response: RazorpaySuccessResponse) => void;
    modal?: {
      ondismiss?: () => void;
      escape?: boolean;
      backdropclose?: boolean;
    };
  }): RazorpayInstance;
}

declare global {
  interface Window {
    Razorpay?: RazorpayConstructor;
  }
}

const RAZORPAY_CHECKOUT_SRC = 'https://checkout.razorpay.com/v1/checkout.js';

let scriptLoadPromise: Promise<void> | null = null;

export function loadRazorpayCheckoutScript(): Promise<void> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Razorpay Checkout is only available in the browser.'));
  }
  if (typeof window.Razorpay === 'function') {
    return Promise.resolve();
  }
  if (scriptLoadPromise) {
    return scriptLoadPromise;
  }

  scriptLoadPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${RAZORPAY_CHECKOUT_SRC}"]`
    );
    if (existing) {
      existing.remove();
    }

    const script = document.createElement('script');
    script.src = RAZORPAY_CHECKOUT_SRC;
    script.async = true;

    const cleanupAndReject = (message: string) => {
      script.remove();
      scriptLoadPromise = null;
      reject(new Error(message));
    };

    const timeoutId = window.setTimeout(() => {
      cleanupAndReject(
        'Razorpay Checkout took too long to load. Please check your connection and try again.'
      );
    }, 12000);

    const handleLoad = () => {
      window.clearTimeout(timeoutId);
      if (typeof window.Razorpay === 'function') {
        resolve();
      } else {
        cleanupAndReject('Razorpay Checkout did not initialize properly. Please try again.');
      }
    };

    const handleError = () => {
      window.clearTimeout(timeoutId);
      cleanupAndReject('Unable to load Razorpay Checkout. Please check your internet connection.');
    };

    script.addEventListener('load', handleLoad, { once: true });
    script.addEventListener('error', handleError, { once: true });
    document.body.appendChild(script);
  });

  return scriptLoadPromise;
}

export class RazorpayCheckoutError extends Error {
  readonly code: 'CANCELLED' | 'FAILED' | 'UNAVAILABLE';

  constructor(code: 'CANCELLED' | 'FAILED' | 'UNAVAILABLE', message: string) {
    super(message);
    this.name = 'RazorpayCheckoutError';
    this.code = code;
  }
}

export async function openRazorpayCheckout(
  config: RazorpayCheckoutConfig
): Promise<RazorpaySuccessResponse> {
  await loadRazorpayCheckoutScript();

  const RazorpayCtor = window.Razorpay;
  if (typeof RazorpayCtor !== 'function') {
    throw new RazorpayCheckoutError(
      'UNAVAILABLE',
      'Razorpay Checkout is unavailable in this browser.'
    );
  }

  return new Promise<RazorpaySuccessResponse>((resolve, reject) => {
    let settled = false;

    const rzp = new RazorpayCtor({
      ...config,
      handler: (response) => {
        if (settled) return;
        settled = true;
        resolve(response);
      },
      modal: {
        escape: true,
        backdropclose: false,
        ondismiss: () => {
          if (settled) return;
          settled = true;
          reject(
            new RazorpayCheckoutError(
              'CANCELLED',
              'Razorpay checkout was closed before payment completed.'
            )
          );
        },
      },
    });

    rzp.on('payment.failed', (failure) => {
      if (settled) return;
      settled = true;
      const desc =
        failure?.error?.description?.trim() ||
        failure?.error?.reason?.trim() ||
        'Payment could not be completed. Please try again.';
      reject(new RazorpayCheckoutError('FAILED', desc));
    });

    rzp.open();
  });
}
