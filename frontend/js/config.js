window.APP_CONFIG = {
  API_BASE:
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1'
      ? 'http://localhost:5000/api'
      : 'https://genuine-cat-production-7821.up.railway.app/api',

  TAX_RATE: 0.05,
  CURRENCY_SYMBOL: '৳',
  CURRENCY_CODE: 'BDT',
  CURRENCY_NAME: 'Taka',

  ONLINE_PAYMENTS: {
    bKash: {
      label: 'bKash',
      merchantNumber: '01903048550',
      qrImage: './qr/bkash.jpeg'
    },
    Nagad: {
      label: 'Nagad',
      merchantNumber: '01903048550',
      qrImage: './qr/nagad.png'
    },
    Rocket: {
      label: 'Rocket',
      merchantNumber: '01903048550',
      qrImage: './qr/rocket.png'
    }
  }
};