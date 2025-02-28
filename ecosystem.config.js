module.exports = {
    apps: [
        {
            name: 'atak-sidc-server-1',
            script: 'node_modules/.bin/next',
            args: 'start',
            instances: 1,
            exec_mode: 'fork',
            autorestart: true,
            max_memory_restart: '1G',
            env: {
                NODE_ENV: 'production',
                PORT: 8080,
                NEXT_TELEMETRY_DISABLED: 1
            },
            error_file: './logs/error-8080.log',
            out_file: './logs/out-8080.log',
            merge_logs: true
        },
        {
            name: 'atak-sidc-server-2',
            script: 'node_modules/.bin/next',
            args: 'start',
            instances: 1,
            exec_mode: 'fork',
            autorestart: true,
            max_memory_restart: '1G',
            env: {
                NODE_ENV: 'production',
                PORT: 8081,
                NEXT_TELEMETRY_DISABLED: 1
            },
            error_file: './logs/error-8081.log',
            out_file: './logs/out-8081.log',
            merge_logs: true
        }
    ],
};