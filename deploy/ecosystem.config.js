// pm2 config for the Kothay Milbe storefront. Used only by the kothaymilbe user's own pm2:
//   pm2 start /home/kothaymilbe/kothaymilbe/deploy/ecosystem.config.js
const path = require("path");

module.exports = {
  apps: [
    {
      name: "kothaymilbe-web",
      cwd: path.join(__dirname, "..", "frontend"),
      // Same command as `npm start` (next start -H 127.0.0.1 -p 3020), run directly so that pm2
      // watches the Next.js process itself: with `npm start`, pm2 would only see the small npm
      // wrapper and max_memory_restart would never trigger.
      script: "node_modules/next/dist/bin/next",
      args: "start -H 127.0.0.1 -p 3020",
      exec_mode: "fork",
      instances: 1,
      autorestart: true,
      max_memory_restart: "600M",
      time: true,
      env: {
        NODE_ENV: "production",
        API_INTERNAL_URL: "http://127.0.0.1:8020",
      },
    },
  ],
};
