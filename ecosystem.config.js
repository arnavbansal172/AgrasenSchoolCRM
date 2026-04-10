module.exports = {
  apps: [
    {
      // Backend API Server (PostgreSQL)
      name: 'savm-backend',
      script: 'backend/index.js',
      cwd: './',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '256M',
      env: {
        NODE_ENV: 'production',
      },
      env_file: './backend/.env',
      error_file: './logs/backend-error.log',
      out_file: './logs/backend-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
    {
      // Frontend Static Server (serves built React app)
      name: 'savm-frontend',
      script: 'node_modules/.bin/serve',
      args: ['dist', '-p', '5173', '-s', '--no-clipboard'],
      cwd: './',
      instances: 1,
      autorestart: true,
      watch: false,
      env: {
        NODE_ENV: 'production',
      },
      error_file: './logs/frontend-error.log',
      out_file: './logs/frontend-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
  ],
};
