export interface RazorpayOrder {
  id: string;
  amount: number;
  currency: string;
  receipt?: string;
  status: string;
}

export interface RazorpayPaymentLink {
  id: string;
  short_url: string;
  status: string;
}

const keyId = process.env.RAZORPAY_KEY_ID;
const keySecret = process.env.RAZORPAY_KEY_SECRET;

const isConfigured = keyId && keySecret && keyId !== 'YOUR_RAZORPAY_KEY_ID' && keySecret !== 'YOUR_RAZORPAY_KEY_SECRET';

if (isConfigured) {
  console.log('Razorpay Service successfully initialized with credentials.');
} else {
  console.warn('Razorpay credentials are not configured. Razorpay Service will operate in Sandbox Mode.');
}

// Helper to construct basic authorization header
function getAuthHeader(): string {
  return 'Basic ' + Buffer.from(`${keyId}:${keySecret}`).toString('base64');
}

export const RazorpayService = {
  async createOrder(amount: number, receiptId: string): Promise<RazorpayOrder> {
    if (!isConfigured) {
      // Return sandbox order
      const mockOrderId = `order_mock_${Math.floor(100000 + Math.random() * 900000)}`;
      console.log(`[Razorpay Sandbox] Created simulated order: ${mockOrderId} (₹${amount})`);
      return {
        id: mockOrderId,
        amount: amount * 100, // in paise
        currency: 'INR',
        receipt: receiptId,
        status: 'created'
      };
    }

    const response = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': getAuthHeader()
      },
      body: JSON.stringify({
        amount: amount * 100, // Convert INR to paise
        currency: 'INR',
        receipt: receiptId
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Razorpay Order creation failed: ${response.statusText} - ${errorText}`);
    }

    return response.json() as Promise<RazorpayOrder>;
  },

  async createRecoveryPaymentLink(
    caseId: string,
    amount: number,
    originalOrderId: string,
    customer: { name: string; email: string; phone: string }
  ): Promise<RazorpayPaymentLink> {
    if (!isConfigured) {
      const mockPlinkId = `plink_mock_${Math.floor(100000 + Math.random() * 900000)}`;
      const mockUrl = `https://rzp.io/i/mock_recovery_${caseId}`;
      console.log(`[Razorpay Sandbox] Created simulated Payment Link: ${mockPlinkId} for case ${caseId} (${mockUrl})`);
      return {
        id: mockPlinkId,
        short_url: mockUrl,
        status: 'issued'
      };
    }

    // Use normalized phone number for Razorpay
    let cleanPhone = customer.phone.replace(/[^0-9]/g, '');
    if (cleanPhone.length === 10) {
      cleanPhone = `+91${cleanPhone}`;
    }

    const response = await fetch('https://api.razorpay.com/v1/payment_links', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': getAuthHeader()
      },
      body: JSON.stringify({
        amount: amount * 100, // in paise
        currency: 'INR',
        accept_partial: false,
        reference_id: caseId,
        description: `Recovery Link for case ${caseId}`,
        customer: {
          name: customer.name,
          email: customer.email,
          contact: cleanPhone
        },
        notify: {
          sms: false,
          email: false
        },
        notes: {
          original_order_id: originalOrderId,
          recovery_case_id: caseId
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Razorpay Payment Link creation failed: ${response.statusText} - ${errorText}`);
    }

    return response.json() as Promise<RazorpayPaymentLink>;
  }
};
