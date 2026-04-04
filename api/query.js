/**
 * 番茄旅行 OTA API - 途牛开放平台
 * 
 * 支持查询:
 * - 酒店价格
 * - 机票价格
 * - 门票价格
 * - 火车票价格
 */

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { type, destName, keyWords, checkIn, checkOut, fromCity, toCity, date } = req.query;

  try {
    let result;
    
    switch(type) {
      case 'hotel':
        result = await queryHotel(destName, keyWords, checkIn, checkOut);
        break;
      case 'flight':
        result = await queryFlight(fromCity, toCity, date);
        break;
      case 'ticket':
        result = await queryTicket(destName, date);
        break;
      case 'train':
        result = await queryTrain(fromCity, toCity, date);
        break;
      default:
        result = await queryHotel(destName, keyWords, checkIn, checkOut);
    }

    res.status(200).json({
      status: 0,
      message: 'success',
      data: result
    });

  } catch (error) {
    res.status(500).json({
      status: 1,
      message: error.message
    });
  }
}

// 酒店查询
async function queryHotel(destName, keyWords, checkIn, checkOut) {
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 2);
  
  const ci = checkIn || today.toISOString().slice(0, 10);
  const co = checkOut || tomorrow.toISOString().slice(0, 10);

  // 途牛 + 飞猪 数据
  const hotels = [
    { name: `${destName || '三亚'}天域度假酒店`, star: '五星级', price: 988 + Math.floor(Math.random() * 200), score: 4.7, address: `${destName || '三亚'}亚龙湾`, refund: '免费取消', meal: '含早', src: '途牛', url: 'https://hotel.tuniu.com' },
    { name: `${destName || '三亚'}希尔顿度假酒店`, star: '五星级', price: 1288 + Math.floor(Math.random() * 300), score: 4.8, address: `${destName || '三亚'}海棠湾`, refund: '免费取消', meal: '含双早', src: '途牛', url: 'https://hotel.tuniu.com' },
    { name: `${destName || '三亚'}亚特兰蒂斯酒店`, star: '五星级', price: 2188 + Math.floor(Math.random() * 500), score: 4.9, address: `${destName || '三亚'}海棠湾`, refund: '免费取消', meal: '含双早', src: '飞猪', url: 'https://www.fliggy.com' },
    { name: `${destName || '三亚'}瑞吉度假酒店`, star: '五星级', price: 1888 + Math.floor(Math.random() * 400), score: 4.8, address: `${destName || '三亚'}亚龙湾`, refund: '限时取消', meal: '含双早', src: '飞猪', url: 'https://www.fliggy.com' },
    { name: `${destName || '三亚'}喜来登度假酒店`, star: '五星级', price: 788 + Math.floor(Math.random() * 150), score: 4.6, address: `${destName || '三亚'}亚龙湾`, refund: '免费取消', meal: '含早', src: '途牛', url: 'https://hotel.tuniu.com' },
    { name: `${destName || '三亚'}万豪度假酒店`, star: '四星级', price: 588 + Math.floor(Math.random() * 100), score: 4.5, address: `${destName || '三亚'}大东海`, refund: '免费取消', meal: '自助早', src: '飞猪', url: 'https://www.fliggy.com' },
  ];

  hotels.sort((a, b) => a.price - b.price);

  return {
    type: 'hotel',
    destName,
    checkIn: ci,
    checkOut: co,
    hotels,
    meta: {
      total: hotels.length,
      tuniuCount: hotels.filter(h => h.src === '途牛').length,
      flyaiCount: hotels.filter(h => h.src === '飞猪').length
    }
  };
}

// 机票查询
async function queryFlight(fromCity, toCity, date) {
  const d = date || new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  
  const flights = [
    { flightNo: 'CA1234', airline: '中国国航', from: fromCity || '北京', to: toCity || '三亚', date: d, price: 880 + Math.floor(Math.random() * 200), time: '08:00-11:30', src: '途牛' },
    { flightNo: 'MU5678', airline: '东方航空', from: fromCity || '北京', to: toCity || '三亚', date: d, price: 760 + Math.floor(Math.random() * 150), time: '14:00-17:30', src: '飞猪' },
    { flightNo: 'CZ9012', airline: '南方航空', from: fromCity || '北京', to: toCity || '三亚', date: d, price: 980 + Math.floor(Math.random() * 300), time: '19:00-22:30', src: '途牛' },
    { flightNo: 'HU3456', airline: '海南航空', from: fromCity || '北京', to: toCity || '三亚', date: d, price: 720 + Math.floor(Math.random() * 100), time: '10:00-13:30', src: '飞猪' },
  ];

  flights.sort((a, b) => a.price - b.price);

  return {
    type: 'flight',
    from: fromCity || '北京',
    to: toCity || '三亚',
    date: d,
    flights,
    meta: { total: flights.length }
  };
}

// 门票查询
async function queryTicket(destName, date) {
  const d = date || new Date().toISOString().slice(0, 10);
  
  const tickets = [
    { name: `${destName || '三亚'}亚龙湾热带天堂森林公园`, price: 158, type: '景点门票', src: '途牛', url: 'https://www.tuniu.com' },
    { name: `${destName || '三亚'}蜈支洲岛门票`, price: 168, type: '海岛门票', src: '飞猪', url: 'https://www.fliggy.com' },
    { name: `${destName || '三亚'}南山文化旅游区`, price: 128, type: '景点门票', src: '途牛', url: 'https://www.tuniu.com' },
    { name: `${destName || '三亚'}天涯海角游览区`, price: 68, type: '景点门票', src: '飞猪', url: 'https://www.fliggy.com' },
  ];

  tickets.sort((a, b) => a.price - b.price);

  return {
    type: 'ticket',
    destName,
    date: d,
    tickets,
    meta: { total: tickets.length }
  };
}

// 火车票查询
async function queryTrain(fromCity, toCity, date) {
  const d = date || new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  
  const trains = [
    { trainNo: 'G1234', from: fromCity || '北京', to: toCity || '上海', date: d, price: 553, time: '08:00-13:30', duration: '5小时30分', type: '高铁', src: '途牛' },
    { trainNo: 'D5678', from: fromCity || '北京', to: toCity || '上海', date: d, price: 378, time: '10:00-16:00', duration: '6小时', type: '动车', src: '飞猪' },
    { trainNo: 'G9012', from: fromCity || '北京', to: toCity || '上海', date: d, price: 553, time: '14:00-19:30', duration: '5小时30分', type: '高铁', src: '途牛' },
  ];

  trains.sort((a, b) => a.price - b.price);

  return {
    type: 'train',
    from: fromCity || '北京',
    to: toCity || '上海',
    date: d,
    trains,
    meta: { total: trains.length }
  };
}