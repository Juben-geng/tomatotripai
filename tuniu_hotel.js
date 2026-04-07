const { spawn } = require('child_process');

// 参数
const cityName = process.argv[2] || '三亚';
const checkIn = process.argv[3] || '2026-04-10';
const checkOut = process.argv[4] || '2026-04-12';

// 构建JSON字符串，用转义引号
const args = '{\\"cityName\\":\\"' + cityName + '\\",\\"checkIn\\":\\"' + checkIn + '\\",\\"checkOut\\":\\"' + checkOut + '\\"}';

console.error('[DEBUG] Args:', args);

// 调用途牛CLI
const child = spawn('tuniu', ['call', 'hotel', 'tuniu_hotel_search', '--args', args], {
    env: { ...process.env, TUNIU_API_KEY: process.env.TUNIU_API_KEY || '' },
    shell: true
});

let stdout = '';
let stderr = '';

child.stdout.on('data', (data) => {
    stdout += data.toString();
});

child.stderr.on('data', (data) => {
    stderr += data.toString();
});

child.on('close', (code) => {
    console.log(stdout);
    if (stderr && !stderr.includes('Assertion failed')) {
        console.error(stderr);
    }
});

child.on('error', (err) => {
    console.error('Error:', err.message);
});
