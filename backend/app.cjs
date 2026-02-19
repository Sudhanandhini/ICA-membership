// cPanel / Phusion Passenger entry point
// This file bridges CommonJS (Passenger) with ES Module (server.js)
'use strict';

process.env.CPANEL_ENTRY = 'true';

(async () => {
  try {
    await import('./server.js');
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
})();
