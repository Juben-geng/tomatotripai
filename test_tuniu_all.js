const { spawn } = require('child_process');

const tools = {
    'hotel': 'tuniu_hotel_search',
    'flight': 'searchLowestPriceFlight',
    'train': 'searchLowestPriceTrain',
    'ticket': 'query_cheapest_tickets',
    'cruise': 'searchCruiseList'
};

const params = {
    'hotel': {"cityName": "三亚", "checkIn": "2026-04-10", "checkOut": "2026-04-12"},
    'flight': {"departureCityName": "北京", "arrivalCityName": "三亚", "departureDate": "2026-04-10"},
    'train': {"departureCityName": "北京", "arrivalCityName": "上海", "departureDate": "2026-04-10"},
    'ticket': {"city_name": "三亚", "scenic_name": "蜈支洲岛"},
    'cruise': {"departsDateBegin": "2026-04-15", "departsDateEnd": "2026-04-20"}
};

const service = process.argv[2] || 'hotel';
const tool = process.argv[3] || tools[service] || 'tuniu_hotel_search';

const args = params[service] || {};
const argsJson = JSON.stringify(args);

console.log('\n' + '='.repeat(60));
console.log('途牛服务测试:', service);
console.log('工具:', tool);
console.log('参数:', argsJson);
console.log('='.repeat(60));

const escapedArgs = '{' + Object.entries(args).map(([k, v]) => `\\"${k}\\":\\"${v}\\"`).join(',') + '}';

const child = spawn('tuniu', ['call', service, tool, '--args', escapedArgs], {
    env: { ...process.env, TUNIU_API_KEY: 'sk-287d9cbde8184f59a9bc957c85520ee3' },
    shell: true
});

let stdout = '';
let stderr = '';

child.stdout.on('data', (data) => { stdout += data.toString(); });
child.stderr.on('data', (data) => { stderr += data.toString(); });

child.on('close', (code) => {
    try {
        const result = JSON.parse(stdout);
        if (result.success) {
            console.log('✅ 成功!');
            const content = result.result?.content?.[0]?.text || '';
            if (content) {
                const inner = JSON.parse(content);
                console.log('消息:', inner.message || 'N/A');
                
                // 酒店数据
                if (inner.hotels) {
                    console.log('酒店数:', inner.hotels.length);
                    inner.hotels.slice(0, 3).forEach((h, i) => {
                        console.log(`  ${i+1}. ${h.hotelName} - ¥${h.lowestPrice}起`);
                    });
                }
                
                // 航班数据
                if (inner.flights) {
                    console.log('航班数:', inner.flights.length);
                    inner.flights.slice(0, 3).forEach((f, i) => {
                        console.log(`  ${i+1}. ${f.flightNumber} ${f.departureTime}-${f.arrivalTime} ¥${f.basePrice || f.price}`);
                    });
                }
                
                // 火车数据
                if (inner.trains) {
                    console.log('车次数:', inner.trains.length);
                    inner.trains.slice(0, 3).forEach((t, i) => {
                        console.log(`  ${i+1}. ${t.trainNo} ${t.departureTime}-${t.arrivalTime} ¥${t.price}`);
                    });
                }
                
                // 门票数据
                if (inner.tickets) {
                    console.log('门票数:', inner.tickets.length);
                    inner.tickets.slice(0, 3).forEach((t, i) => {
                        console.log(`  ${i+1}. ${t.name} ¥${t.price}`);
                    });
                }
                
                // 邮轮数据
                if (inner.cruises) {
                    console.log('邮轮数:', inner.cruises.length);
                    inner.cruises.slice(0, 3).forEach((c, i) => {
                        console.log(`  ${i+1}. ${c.name} ¥${c.price}`);
                    });
                }
                
                // 打印完整数据结构（用于调试）
                console.log('\n数据结构:', Object.keys(inner));
                
                // 检查data字段
                if (inner.data) {
                    console.log('data字段类型:', typeof inner.data);
                    if (Array.isArray(inner.data)) {
                        console.log('data数组长度:', inner.data.length);
                        inner.data.slice(0, 3).forEach((item, i) => {
                            console.log(`  ${i+1}.`, JSON.stringify(item).substring(0, 100));
                        });
                    } else if (typeof inner.data === 'object') {
                        console.log('data对象键:', Object.keys(inner.data));
                    }
                }
            }
        } else {
            console.log('❌ 失败:', result.error?.message || 'Unknown');
        }
    } catch (e) {
        console.log('❌ 解析错误:', e.message);
        console.log('原始输出:', stdout.substring(0, 500));
    }
});
